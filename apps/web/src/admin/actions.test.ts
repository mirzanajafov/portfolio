import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn, signOut } from './actions';
import { linkCookie, sessionCookie } from './cookies';
import { request } from './testing';
import type { endSession, startSession } from './api';

const link = 'l'.repeat(43);
const session = 's'.repeat(43);
const ends = new Date('2026-11-29T12:00:00Z');

const api = vi.hoisted(() => ({
  startSession: vi.fn<typeof startSession>(),
  endSession: vi.fn<typeof endSession>(),
}));

vi.mock('next/headers', async () => (await import('./testing')).nextHeaders);
vi.mock('next/navigation', async () => (await import('./testing')).nextNavigation);
vi.mock('./api', () => api);

function arriving(origin: string | null, cookies: Record<string, string>) {
  request.headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
  if (origin !== null) {
    request.headers.set('origin', origin);
  }
  request.cookies = new Map(Object.entries(cookies));
}

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  vi.stubEnv('SITE_ORIGIN', undefined);
  request.set.mockClear();
  request.delete.mockClear();
  api.startSession.mockReset();
  api.endSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signIn', () => {
  it('trades the link for a strict session cookie that ends with the session, and opens /admin', async () => {
    arriving('https://najafov.dev', { [linkCookie.name]: link });
    api.startSession.mockResolvedValue({ kind: 'signed in', token: session, expiresAt: ends });

    await expect(signIn()).rejects.toThrow('redirect to /admin');
    expect(api.startSession).toHaveBeenCalledWith('http://api:3201', link, '203.0.113.7');
    expect(request.delete).toHaveBeenCalledWith(linkCookie);
    expect(request.set).toHaveBeenCalledWith({
      name: '__Host-admin',
      value: session,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: ends,
    });
  });

  it.each([
    ['another origin', 'https://najafov.dev.example.com'],
    ['the site over plain HTTP', 'http://najafov.dev'],
    ['no Origin header', null],
  ])('is a 404 for a POST from %s, before it reads the link', async (_, origin) => {
    arriving(origin, { [linkCookie.name]: link });

    await expect(signIn()).rejects.toThrow('not found');
    expect(api.startSession).not.toHaveBeenCalled();
    expect(request.delete).not.toHaveBeenCalled();
  });

  it('takes the origin from SITE_ORIGIN when it is set', async () => {
    vi.stubEnv('SITE_ORIGIN', 'http://localhost:3210');
    arriving('https://najafov.dev', { [linkCookie.name]: link });
    await expect(signIn()).rejects.toThrow('not found');

    arriving('http://localhost:3210', { [linkCookie.name]: link });
    api.startSession.mockResolvedValue({ kind: 'refused' });
    await expect(signIn()).resolves.toMatch(/expired/);
  });

  it('says the link has expired or was used, and leaves the cookies alone so the page stays to say it', async () => {
    arriving('https://najafov.dev', { [linkCookie.name]: link });
    api.startSession.mockResolvedValue({ kind: 'refused' });

    expect(await signIn()).toBe(
      'This link has expired or was already used. Run admin link for a new one.',
    );
    expect(request.delete).not.toHaveBeenCalled();
    expect(request.set).not.toHaveBeenCalled();
  });

  it('says the same without asking the API when the link cookie is gone or malformed', async () => {
    arriving('https://najafov.dev', {});
    expect(await signIn()).toMatch(/^This link has expired/);
    arriving('https://najafov.dev', { [linkCookie.name]: 'short' });
    expect(await signIn()).toMatch(/^This link has expired/);
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it('keeps the link and says how long to wait when the network signed in too often', async () => {
    arriving('https://najafov.dev', { [linkCookie.name]: link });
    api.startSession.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 401 });
    expect(await signIn()).toBe('Too many sign-ins from this network. Try again in 7 minutes.');

    api.startSession.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 30 });
    expect(await signIn()).toBe('Too many sign-ins from this network. Try again in a minute.');
    expect(request.delete).not.toHaveBeenCalled();
  });

  it('lets a failing API fail the sign-in', async () => {
    arriving('https://najafov.dev', { [linkCookie.name]: link });
    api.startSession.mockRejectedValue(new Error('the API answered 500 to a sign-in'));

    await expect(signIn()).rejects.toThrow('the API answered 500 to a sign-in');
    expect(request.set).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('ends the session in the API, deletes the cookie with its attributes and stays on /admin, where the tracker is off', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.endSession.mockResolvedValue();

    await expect(signOut()).rejects.toThrow('redirect to /admin');
    expect(api.endSession).toHaveBeenCalledWith('http://api:3201', session);
    expect(request.delete).toHaveBeenCalledWith(sessionCookie);
  });

  it('is a 404 for a POST from another origin, and ends nothing', async () => {
    arriving('https://evil.example', { [sessionCookie.name]: session });

    await expect(signOut()).rejects.toThrow('not found');
    expect(api.endSession).not.toHaveBeenCalled();
    expect(request.delete).not.toHaveBeenCalled();
  });

  it('still clears the cookie when there is no session to end', async () => {
    arriving('https://najafov.dev', {});

    await expect(signOut()).rejects.toThrow('redirect to /admin');
    expect(api.endSession).not.toHaveBeenCalled();
    expect(request.delete).toHaveBeenCalledWith(sessionCookie);
  });
});

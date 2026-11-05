import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addApplication, editApplication, signIn, signOut, undoStatus } from './actions';
import { linkCookie, sessionCookie } from './cookies';
import { request } from './testing';
import { anApplicationPage } from '@portfolio/content/testing';
import type {
  createApplication,
  endSession,
  startSession,
  undoStatusChange,
  updateApplication,
} from './api';

const link = 'l'.repeat(43);
const session = 's'.repeat(43);
const ends = new Date('2026-11-29T12:00:00Z');

const api = vi.hoisted(() => ({
  startSession: vi.fn<typeof startSession>(),
  endSession: vi.fn<typeof endSession>(),
  createApplication: vi.fn<typeof createApplication>(),
  updateApplication: vi.fn<typeof updateApplication>(),
  undoStatusChange: vi.fn<typeof undoStatusChange>(),
}));

vi.mock('next/headers', async () => (await import('./testing')).nextHeaders);
vi.mock('next/navigation', async () => (await import('./testing')).nextNavigation);
vi.mock(import('./api'), async (importOriginal) => ({ ...(await importOriginal()), ...api }));

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
  api.createApplication.mockReset();
  api.updateApplication.mockReset();
  api.undoStatusChange.mockReset();
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

describe('the application actions', () => {
  const { undoTo: _, ...memh } = anApplicationPage();
  const done = { kind: 'done', application: memh } as const;

  function formOf(fields: Record<string, string>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      form.set(name, value);
    }
    return form;
  }

  it('adds an application from the form, leaving out empty hints, and opens its page', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.createApplication.mockResolvedValue(done);
    const form = formOf({
      company: ' Acme ',
      role: 'Backend Engineer',
      appliedOn: '2026-10-30',
      channel: 'direct',
      cvVariant: 'base',
      code: '',
      country: 'AZ',
      city: '',
      atsHost: '',
      networks: 'ACME-NET\n\n ACME-VPN \n',
    });

    await expect(addApplication(null, form)).rejects.toThrow(
      'redirect to /admin/applications/memh',
    );
    expect(api.createApplication).toHaveBeenCalledWith('http://api:3201', session, {
      company: 'Acme',
      role: 'Backend Engineer',
      appliedOn: '2026-10-30',
      channel: 'direct',
      cvVariant: 'base',
      country: 'AZ',
      networks: ['ACME-NET', 'ACME-VPN'],
    });
  });

  it('edits with every field of the form, clearing an emptied hint and leaving out an empty answer day', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.updateApplication.mockResolvedValue(done);
    const form = formOf({
      company: 'Acme',
      role: 'Backend Engineer',
      appliedOn: '2026-10-30',
      channel: 'referral',
      cvVariant: 'base',
      status: 'screening',
      answeredOn: '',
      notes: 'Called back',
      country: '',
      city: 'Baku',
      atsHost: '',
      networks: '',
    });

    await expect(editApplication('memh', null, form)).rejects.toThrow(
      'redirect to /admin/applications/memh',
    );
    expect(api.updateApplication).toHaveBeenCalledWith('http://api:3201', session, 'memh', {
      company: 'Acme',
      role: 'Backend Engineer',
      appliedOn: '2026-10-30',
      channel: 'referral',
      cvVariant: 'base',
      status: 'screening',
      notes: 'Called back',
      country: null,
      city: 'Baku',
      atsHost: null,
      networks: [],
    });
  });

  it('undoes the last move and opens the page again', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.undoStatusChange.mockResolvedValue(done);

    await expect(undoStatus('memh')).rejects.toThrow('redirect to /admin/applications/memh');
    expect(api.undoStatusChange).toHaveBeenCalledWith('http://api:3201', session, 'memh');
  });

  it('shows the reason the API refused a write with what was typed, so the form can keep it', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.updateApplication.mockResolvedValue({ kind: 'refused', message: 'no move' });

    const state = await editApplication(
      'memh',
      null,
      formOf({ notes: ' Called back ', status: 'offer' }),
    );

    expect(state?.failure).toBe('no move');
    expect(state?.values).toMatchObject({ notes: 'Called back', status: 'offer', company: '' });
  });

  it('says how long to wait after too many changes', async () => {
    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.undoStatusChange.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 600 });

    expect(await undoStatus('memh')).toBe('Too many changes. Try again in 10 minutes.');
  });

  it('says the session has ended, keeping what was typed, when the cookie is gone or the API refuses the session', async () => {
    arriving('https://najafov.dev', {});
    const added = await addApplication(null, formOf({ company: 'Acme' }));
    expect(added?.failure).toBe('The session has ended. Run admin link for a new sign-in link.');
    expect(added?.values).toMatchObject({ company: 'Acme' });
    expect(await undoStatus('memh')).toBe(
      'The session has ended. Run admin link for a new sign-in link.',
    );
    expect(api.createApplication).not.toHaveBeenCalled();

    arriving('https://najafov.dev', { [sessionCookie.name]: session });
    api.updateApplication.mockResolvedValue({ kind: 'missing' });
    expect((await editApplication('memh', null, formOf({})))?.failure).toBe(
      'The session has ended or the application is gone. Run admin link for a new sign-in link.',
    );
  });

  it.each([
    ['from another origin', 'https://evil.example', 'memh'],
    ['for a code a link could not carry', 'https://najafov.dev', '../session'],
  ])('is a 404 %s, before it asks the API', async (_, origin, code) => {
    arriving(origin, { [sessionCookie.name]: session });

    await expect(undoStatus(code)).rejects.toThrow('not found');
    await expect(editApplication(code, null, formOf({}))).rejects.toThrow('not found');
    expect(api.undoStatusChange).not.toHaveBeenCalled();
    expect(api.updateApplication).not.toHaveBeenCalled();
  });

  it('is a 404 for an add from another origin', async () => {
    arriving('https://evil.example', { [sessionCookie.name]: session });

    await expect(addApplication(null, formOf({}))).rejects.toThrow('not found');
    expect(api.createApplication).not.toHaveBeenCalled();
  });
});

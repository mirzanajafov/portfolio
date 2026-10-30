import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/admin/next-request.fake';
import type { sessionExpiry } from '@/admin/sessions';
import AdminPage from './page';

const session = 's'.repeat(43);

const api = vi.hoisted(() => ({ sessionExpiry: vi.fn<typeof sessionExpiry>() }));

vi.mock('next/headers', async () => (await import('@/admin/next-request.fake')).nextHeaders);
vi.mock('next/navigation', async () => (await import('@/admin/next-request.fake')).nextNavigation);

vi.mock('@/admin/sessions', () => api);

vi.mock('@/admin/actions', () => ({ signOut: async () => undefined }));

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = new Map([['__Host-admin', session]]);
  api.sessionExpiry.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin page', () => {
  it('says until when the session lasts, in Baku time, and offers to sign out', async () => {
    api.sessionExpiry.mockResolvedValue(new Date('2026-11-29T18:53:00Z'));

    render(await AdminPage());

    expect(api.sessionExpiry).toHaveBeenCalledWith('http://api:3201', session);
    expect(
      screen.getByText(/^Signed in until 29 November 2026 at 22:53, Baku time\.$/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it.each([
    ['no session cookie', new Map<string, string>()],
    ['a malformed session cookie', new Map([['__Host-admin', 'short']])],
  ])('is the 404 page with %s, without asking the API', async (_, cookies) => {
    request.cookies = cookies;

    await expect(AdminPage()).rejects.toThrow('not found');
    expect(api.sessionExpiry).not.toHaveBeenCalled();
  });

  it('is the 404 page when the API does not know the session', async () => {
    api.sessionExpiry.mockResolvedValue(null);

    await expect(AdminPage()).rejects.toThrow('not found');
  });

  it('fails rather than shows a 404 when the API fails, so an outage is not a lost session', async () => {
    api.sessionExpiry.mockRejectedValue(new Error('the API answered 502 to a session check'));

    await expect(AdminPage()).rejects.toThrow('the API answered 502 to a session check');
  });
});

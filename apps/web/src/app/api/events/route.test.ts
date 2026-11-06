import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/admin/testing';
import { POST } from './route';

vi.mock('next/headers', async () => (await import('@/admin/testing')).nextHeaders);

const session = 's'.repeat(43);

const post = () => new Request('http://site/api/events', { method: 'POST', body: '{}' });

async function headersSentWith(cookies: Map<string, string>) {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = cookies;
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchImpl);
  await POST(post());
  return fetchImpl.mock.calls[0]?.[1]?.headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/events', () => {
  it('fails loudly instead of guessing an API address when API_URL is missing', async () => {
    vi.stubEnv('API_URL', undefined);
    await expect(POST(post())).rejects.toThrow(/API_URL is not set/);
  });

  it('passes the admin session of a signed-in browser to the API', async () => {
    expect(await headersSentWith(new Map([['__Host-admin', session]]))).toEqual({
      'content-type': 'application/json',
      authorization: `Bearer ${session}`,
    });
  });

  it.each([
    ['no session cookie', new Map<string, string>()],
    ['a malformed session cookie', new Map([['__Host-admin', 'short']])],
  ])('passes no session for %s', async (_, cookies) => {
    expect(await headersSentWith(cookies)).toEqual({ 'content-type': 'application/json' });
  });
});

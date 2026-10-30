import { content, siteUrl } from '@portfolio/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { isRegistered } from '@/admin/api';
import { request } from '@/admin/testing';
import { cvFileName } from '@/lib/cv-pdf';
import { GET } from './route';

const session = 's'.repeat(43);

const api = vi.hoisted(() => ({ isRegistered: vi.fn<typeof isRegistered>() }));

vi.mock('next/headers', async () => (await import('@/admin/testing')).nextHeaders);
vi.mock('@/admin/api', () => api);

function download(code: string) {
  return GET(new Request(`https://najafov.dev/admin/applications/${code}/cv`), {
    params: Promise.resolve({ code }),
  });
}

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = new Map([['__Host-admin', session]]);
  api.isRegistered.mockReset();
  api.isRegistered.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /admin/applications/[code]/cv', () => {
  it('downloads the CV with the code in its links, and keeps it out of every cache', async () => {
    const response = await download('memh');

    expect(api.isRegistered).toHaveBeenCalledWith('http://api:3201', session, 'memh');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${cvFileName(content)}"`,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdf).toContain(`/URI (${new URL(siteUrl).origin}/?r=memh)`);
  });

  it('answers 404 for a code nobody registered, or when the API knows no such session', async () => {
    api.isRegistered.mockResolvedValue(false);

    const response = await download('memh');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['without a session cookie', new Map<string, string>(), 'memh'],
    ['with a malformed session cookie', new Map([['__Host-admin', 'short']]), 'memh'],
    ['for a code a link could not carry', new Map([['__Host-admin', session]]), 'Memh!'],
  ])('answers 404 %s, without asking the API', async (_, cookies, code) => {
    request.cookies = cookies;

    expect((await download(code)).status).toBe(404);
    expect(api.isRegistered).not.toHaveBeenCalled();
  });

  it('fails rather than answers 404 when the API fails', async () => {
    api.isRegistered.mockRejectedValue(new Error('the API answered 502 to an application check'));

    await expect(download('memh')).rejects.toThrow('the API answered 502 to an application check');
  });
});

import { content } from '@portfolio/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cvFileName } from '@/lib/cv-pdf';
import { siteUrl } from '@/lib/site';
import { GET } from './route';

const token = 'a'.repeat(64);

function ask(code: string, headers: Record<string, string> = {}) {
  return GET(new Request(`http://portfolio-web:3200/internal/cv/${code}`, { headers }), {
    params: Promise.resolve({ code }),
  });
}

beforeEach(() => {
  vi.stubEnv('CV_RENDER_TOKEN', token);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /internal/cv/[code]', () => {
  it('renders the CV with the code in its links for a caller inside the Docker network with the token', async () => {
    const response = await ask('memh', {
      authorization: `Bearer ${token}`,
      'x-forwarded-for': '172.18.0.4',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${cvFileName(content)}"`,
    );
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdf).toContain(`/URI (${new URL(siteUrl).origin}/?r=memh)`);
  });

  it.each([
    ['without the token', {}],
    ['with another token', { authorization: `Bearer ${'b'.repeat(64)}` }],
    [
      'through the edge proxy',
      { authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.7' },
    ],
  ])('answers like a missing page %s', async (_, headers: Record<string, string>) => {
    expect((await ask('memh', headers)).status).toBe(404);
  });

  it('answers like a missing page for a code the links could not carry', async () => {
    expect((await ask('Acme', { authorization: `Bearer ${token}` })).status).toBe(404);
  });

  it('stays off when the server has no token', async () => {
    vi.stubEnv('CV_RENDER_TOKEN', undefined);
    expect((await ask('memh', { authorization: 'Bearer ' })).status).toBe(404);
  });
});

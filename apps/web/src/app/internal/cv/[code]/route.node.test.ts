import { content, siteUrl } from '@portfolio/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cvFileName } from '@/lib/cv-pdf';
import { GET } from './route';

const token = 'a'.repeat(64);
const inside = { 'x-forwarded-for': '172.18.0.4' };

function ask(code: string, headers: Record<string, string>) {
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
    const response = await ask('memh', { ...inside, authorization: `Bearer ${token}` });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${cvFileName(content)}"`,
    );
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdf).toContain(`/URI (${new URL(siteUrl).origin}/?r=memh)`);
  });

  it.each([
    ['without the token', inside],
    ['with another token', { ...inside, authorization: `Bearer ${'b'.repeat(64)}` }],
    [
      'through the edge proxy',
      { authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.7' },
    ],
    [
      'when the client put an inside address before the one the edge wrote',
      { authorization: `Bearer ${token}`, 'x-forwarded-for': '172.18.0.4, 203.0.113.7' },
    ],
    ['without the address of the caller', { authorization: `Bearer ${token}` }],
  ])('answers 404 %s', async (_, headers: Record<string, string>) => {
    expect((await ask('memh', headers)).status).toBe(404);
  });

  it('answers 404 for a code the links could not carry', async () => {
    expect((await ask('Acme', { ...inside, authorization: `Bearer ${token}` })).status).toBe(404);
  });

  it('stays off when the server has no token', async () => {
    vi.stubEnv('CV_RENDER_TOKEN', undefined);
    expect((await ask('memh', { ...inside, authorization: 'Bearer undefined' })).status).toBe(404);
  });
});

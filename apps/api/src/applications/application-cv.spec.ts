import { describe, expect, it, vi } from 'vitest';
import { fetchApplicationCv } from './application-cv.js';

const site = { webUrl: 'http://portfolio-web:3200', token: 't'.repeat(64) };

describe('fetchApplicationCv', () => {
  it('asks the site inside the Docker network for the CV, with the render token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('%PDF-1.3', { status: 200 }));
    const pdf = await fetchApplicationCv('memh', site, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://portfolio-web:3200/internal/cv/memh', {
      headers: { authorization: `Bearer ${'t'.repeat(64)}` },
    });
    expect(pdf.toString()).toBe('%PDF-1.3');
  });

  it('says which code the site refused', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    await expect(fetchApplicationCv('memh', site, fetchImpl)).rejects.toThrow(
      'the site answered 404 for the CV of memh',
    );
  });
});

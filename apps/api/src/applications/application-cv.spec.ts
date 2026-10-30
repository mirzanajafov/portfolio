import { afterEach, describe, expect, it, vi } from 'vitest';
import { CvFetchError, fetchApplicationCv } from './application-cv.js';

const site = { webUrl: 'http://portfolio-web:3200', token: 't'.repeat(64) };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchApplicationCv', () => {
  it('asks the site inside the Docker network for the CV, with the render token and a ten-second limit', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('%PDF-1.3', { status: 200 }));
    const pdf = await fetchApplicationCv('memh', site, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://portfolio-web:3200/internal/cv/memh');
    expect(init?.headers).toEqual({ authorization: `Bearer ${'t'.repeat(64)}` });
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(init?.signal).toBe(timeout.mock.results[0]?.value);
    expect(pdf.toString()).toBe('%PDF-1.3');
  });

  it('says which code the site refused', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    await expect(fetchApplicationCv('memh', site, fetchImpl)).rejects.toThrow(
      new CvFetchError('memh', 'the site answered 404 for the CV of memh'),
    );
  });

  it('says which code the site never answered for, and why', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(fetchApplicationCv('memh', site, fetchImpl)).rejects.toThrow(
      new CvFetchError(
        'memh',
        'the site at http://portfolio-web:3200 did not answer for the CV of memh (fetch failed)',
      ),
    );
  });
});

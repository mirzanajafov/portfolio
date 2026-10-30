import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';

describe('headers on /admin paths', () => {
  it('keep admin pages out of search, and keep the Origin a form posted before hydration needs', async () => {
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ]);
  });
});

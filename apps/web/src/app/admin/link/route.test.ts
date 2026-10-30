import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

const token = 'Ab_-'.repeat(10) + 'xyz';

describe('GET /admin/link', () => {
  it('moves the token into a lax cookie for ten minutes and redirects to a URL without it', () => {
    const response = GET(new NextRequest(`https://najafov.dev/admin/link?token=${token}`));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const attributes = response.headers.get('set-cookie')?.split('; ') ?? [];
    expect(attributes.filter((attribute) => !attribute.startsWith('Expires='))).toEqual([
      `__Host-admin-link=${token}`,
      'Path=/',
      'Max-Age=600',
      'Secure',
      'HttpOnly',
      'SameSite=lax',
    ]);
  });

  it.each([
    ['no token', ''],
    ['a token of the wrong length', '?token=short'],
    ['a token with characters base64url does not use', `?token=${'a'.repeat(42)}%3D`],
  ])('sets no cookie for %s, so the next page is a 404', (_, query) => {
    const response = GET(new NextRequest(`https://najafov.dev/admin/link${query}`));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin/login');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

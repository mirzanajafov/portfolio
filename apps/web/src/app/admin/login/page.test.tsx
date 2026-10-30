import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInPage from './page';

const request = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = request.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));

vi.mock('@/admin/actions', () => ({ signIn: async () => 'refused' }));

beforeEach(() => {
  request.cookies = new Map();
});

describe('sign-in page', () => {
  it('offers one button that spends the link', async () => {
    request.cookies.set('__Host-admin-link', 'l'.repeat(43));

    render(await SignInPage());

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  it.each([
    ['no link cookie', undefined],
    ['a malformed link cookie', 'short'],
  ])('is the 404 page with %s', async (_, value) => {
    if (value !== undefined) {
      request.cookies.set('__Host-admin-link', value);
    }

    await expect(SignInPage()).rejects.toThrow('not found');
  });
});

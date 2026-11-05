import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { sessionExpiry } from '@/admin/api';
import { request } from '@/admin/testing';
import AddApplicationPage, { dynamic } from './page';

const session = 's'.repeat(43);

const api = vi.hoisted(() => ({ sessionExpiry: vi.fn<typeof sessionExpiry>() }));

vi.mock('next/headers', async () => (await import('@/admin/testing')).nextHeaders);
vi.mock('next/navigation', async () => (await import('@/admin/testing')).nextNavigation);
vi.mock('@/admin/api', () => api);
vi.mock('@/admin/actions', () => ({ addApplication: async () => null }));

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = new Map([['__Host-admin', session]]);
  api.sessionExpiry.mockReset();
  api.sessionExpiry.mockResolvedValue(new Date('2026-11-29T18:53:00Z'));
});

describe('add page', () => {
  it('offers the form to a session the API knows', async () => {
    render(await AddApplicationPage());

    expect(api.sessionExpiry).toHaveBeenCalledWith('http://api:3201', session);
    expect(screen.getByRole('heading', { name: 'Add an application' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to admin' })).toHaveAttribute('href', '/admin');
  });

  it('is the 404 page without a session cookie, or for a session the API refused', async () => {
    api.sessionExpiry.mockResolvedValue(null);
    await expect(AddApplicationPage()).rejects.toThrow('not found');

    request.cookies = new Map();
    api.sessionExpiry.mockClear();
    await expect(AddApplicationPage()).rejects.toThrow('not found');
    expect(api.sessionExpiry).not.toHaveBeenCalled();
  });

  it('is declared dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});

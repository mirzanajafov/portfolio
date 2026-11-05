import { anApplicationPage } from '@portfolio/content/testing';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { fetchApplication } from '@/admin/api';
import { request } from '@/admin/testing';
import EditApplicationPage, { dynamic } from './page';

const session = 's'.repeat(43);

const api = vi.hoisted(() => ({ fetchApplication: vi.fn<typeof fetchApplication>() }));

vi.mock('next/headers', async () => (await import('@/admin/testing')).nextHeaders);
vi.mock('next/navigation', async () => (await import('@/admin/testing')).nextNavigation);
vi.mock('@/admin/api', () => api);
vi.mock('@/admin/actions', () => ({
  editApplication: async () => null,
  undoStatus: async () => null,
}));

function open(code: string) {
  return EditApplicationPage({
    params: Promise.resolve({ code }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = new Map([['__Host-admin', session]]);
  api.fetchApplication.mockReset();
  api.fetchApplication.mockResolvedValue(anApplicationPage());
});

describe('application page', () => {
  it('names the application, links its CV and offers the edit form', async () => {
    api.fetchApplication.mockResolvedValue(anApplicationPage({ firstSeenOn: '2026-11-01' }));

    render(await open('memh'));

    expect(api.fetchApplication).toHaveBeenCalledWith('http://api:3201', session, 'memh');
    expect(screen.getByRole('heading', { name: 'Acme, Backend Engineer' })).toBeVisible();
    expect(
      screen.getByText('Code memh, applied 2026-10-30, sent, link first opened 2026-11-01'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download CV' })).toHaveAttribute(
      'href',
      '/admin/applications/memh/cv',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('offers an undo only when there is a move to undo', async () => {
    render(await open('memh'));
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();

    api.fetchApplication.mockResolvedValue(
      anApplicationPage({ status: 'screening', undoTo: 'sent' }),
    );
    render(await open('memh'));
    expect(screen.getByRole('button', { name: 'Undo the last move, back to sent' })).toBeVisible();
  });

  it('is the 404 page for a code nobody has, or for one a link could not carry without asking the API', async () => {
    api.fetchApplication.mockResolvedValue(null);
    await expect(open('memj')).rejects.toThrow('not found');

    api.fetchApplication.mockClear();
    await expect(open('Memh!')).rejects.toThrow('not found');
    expect(api.fetchApplication).not.toHaveBeenCalled();
  });

  it('is the 404 page without a session cookie, before it asks the API', async () => {
    request.cookies = new Map();

    await expect(open('memh')).rejects.toThrow('not found');
    expect(api.fetchApplication).not.toHaveBeenCalled();
  });

  it('is declared dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});

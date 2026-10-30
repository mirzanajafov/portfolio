import { aReport, anEntry, noOutcomes } from '@portfolio/content/testing';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fetchReport, sessionExpiry } from '@/admin/api';
import { request } from '@/admin/testing';
import AdminPage, { dynamic } from './page';

const session = 's'.repeat(43);

const api = vi.hoisted(() => ({
  sessionExpiry: vi.fn<typeof sessionExpiry>(),
  fetchReport: vi.fn<typeof fetchReport>(),
}));

vi.mock('next/headers', async () => (await import('@/admin/testing')).nextHeaders);
vi.mock('next/navigation', async () => (await import('@/admin/testing')).nextNavigation);

vi.mock('@/admin/api', () => api);

vi.mock('@/admin/actions', () => ({ signOut: async () => undefined }));

function open(query: Record<string, string | string[]> = {}) {
  return AdminPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
}

const twelveEntries = Array.from({ length: 12 }, (_, index) => ({
  path: `/page-${String(index + 1)}`,
  visits: 12 - index,
}));

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api:3201');
  request.cookies = new Map([['__Host-admin', session]]);
  api.sessionExpiry.mockReset();
  api.sessionExpiry.mockResolvedValue(new Date('2026-11-29T18:53:00Z'));
  api.fetchReport.mockReset();
  api.fetchReport.mockResolvedValue(aReport());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin page', () => {
  it('says until when the session lasts in Baku time, and shows the report under it', async () => {
    render(await open());

    expect(api.sessionExpiry).toHaveBeenCalledWith('http://api:3201', session);
    expect(screen.getByText('Signed in until 2026-11-29 22:53 Baku time.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(
      screen.getByText(
        'Visits in the last 7 full days and today: 2026-10-23 to 2026-10-30 UTC, today until 2026-10-30 16:00 Baku time',
      ),
    ).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Overview' })).toBeVisible();
  });

  it('leaves the default period to the API and marks the period the report covers', async () => {
    render(await open());
    expect(api.fetchReport).toHaveBeenCalledWith('http://api:3201', session, undefined);
    expect(screen.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '30 days' })).toHaveAttribute('href', '/admin?days=30');
  });

  it('asks the API for the days in the address', async () => {
    await open({ days: '30' });

    expect(api.fetchReport).toHaveBeenCalledWith('http://api:3201', session, 30);
  });

  it('cuts long lists at ten rows and links to all of them', async () => {
    api.fetchReport.mockResolvedValue(aReport({ entries: twelveEntries }));

    render(await open());

    expect(screen.getByRole('cell', { name: '/page-10' })).toBeVisible();
    expect(screen.queryByRole('cell', { name: '/page-11' })).toBeNull();
    expect(screen.getByText('and 2 more')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Show everything' })).toHaveAttribute(
      'href',
      '/admin?days=7&all=1',
    );
  });

  it('shows every row when asked for all of them', async () => {
    api.fetchReport.mockResolvedValue(aReport({ entries: twelveEntries }));

    render(await open({ days: '7', all: '1' }));

    expect(screen.getByRole('cell', { name: '/page-12' })).toBeVisible();
    expect(screen.queryByText('and 2 more')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cut long lists' })).toHaveAttribute(
      'href',
      '/admin?days=7',
    );
  });

  it('links each application to its CV', async () => {
    api.fetchReport.mockResolvedValue(
      aReport({
        applications: {
          list: [anEntry(), anEntry({ code: 'kxqtz', company: 'Wolt' })],
          score: { visits: 0, unplaced: 0, levels: noOutcomes() },
          unknownCodes: [],
        },
      }),
    );

    render(await open());

    expect(
      screen.getByText('Xsolla, Backend Engineer, applied 2026-10-29, code memh: no visits yet'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download CV for memh' })).toHaveAttribute(
      'href',
      '/admin/applications/memh/cv',
    );
    expect(screen.getByRole('link', { name: 'Download CV for kxqtz' })).toHaveAttribute(
      'href',
      '/admin/applications/kxqtz/cv',
    );
  });

  it('writes out the control characters a visitor sent, so they cannot reorder the text', async () => {
    const error = {
      message: 'failed in \u202e.txt',
      source: '/app.js',
      count: 1,
      paths: ['/'],
      browsers: ['chrome'],
    };
    api.fetchReport.mockResolvedValue(
      aReport({ quality: { vitals: [], errors: [error], notFound: [] } }),
    );

    render(await open());

    expect(screen.getByRole('cell', { name: 'failed in \\u{202e}.txt' })).toBeVisible();
    expect(document.body.textContent).not.toContain('\u202e');
  });

  it.each([['0'], ['14'], ['31'], ['week'], [['1', '7']]])(
    'is the 404 page for %j days, without asking the API',
    async (days) => {
      await expect(open({ days })).rejects.toThrow('not found');
      expect(api.fetchReport).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no session cookie', new Map<string, string>()],
    ['a malformed session cookie', new Map([['__Host-admin', 'short']])],
  ])('is the 404 page with %s, without asking the API', async (_, cookies) => {
    request.cookies = cookies;

    await expect(open()).rejects.toThrow('not found');
    expect(api.sessionExpiry).not.toHaveBeenCalled();
    expect(api.fetchReport).not.toHaveBeenCalled();
  });

  it('is the 404 page when the API knows no such session', async () => {
    api.sessionExpiry.mockResolvedValue(null);
    api.fetchReport.mockResolvedValue(null);

    await expect(open()).rejects.toThrow('not found');
  });

  it.each([
    ['session check', api.sessionExpiry],
    ['report', api.fetchReport],
  ] as const)(
    'fails rather than shows a 404 when the %s fails, so an outage is not a lost session',
    async (what, call) => {
      call.mockRejectedValue(new Error(`the API answered 502 to a ${what}`));

      await expect(open()).rejects.toThrow(`the API answered 502 to a ${what}`);
    },
  );

  it('is declared dynamic, so Next renders it per request and sends it with no-store', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});

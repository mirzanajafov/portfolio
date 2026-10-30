import type { ApplicationRow } from './report/rows.js';
import type { ViewRow, VisitRow } from './visits.js';

export const now = new Date('2026-10-30T12:00:00Z');

export function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function daysAgo(days: number): Date {
  return hoursAgo(days * 24);
}

export function aView(overrides: Partial<ViewRow> = {}): ViewRow {
  return {
    createdAt: hoursAgo(1),
    path: '/',
    notFound: false,
    referrerHost: null,
    ref: null,
    activeSeconds: 30,
    maxScroll: 50,
    blocks: {},
    lcpMs: null,
    inpMs: null,
    cls: null,
    clicks: [],
    errors: [],
    ...overrides,
  };
}

export function aVisit(
  views: ViewRow[] = [aView()],
  overrides: Partial<Omit<VisitRow, 'views'>> = {},
): VisitRow {
  return {
    startedAt: hoursAgo(1),
    device: 'desktop',
    browser: 'chrome',
    country: 'AZ',
    city: 'Baku',
    network: null,
    views,
    ...overrides,
  };
}

export function anApplication(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: 'xsolla',
    code: 'memh',
    company: 'Xsolla',
    role: 'Backend Engineer',
    appliedOn: new Date('2026-10-29'),
    country: null,
    city: null,
    atsHost: null,
    networks: [],
    ...overrides,
  };
}

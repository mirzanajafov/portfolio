import type { DemoSite } from '@portfolio/content/analytics';
import type { ApplicationRow } from './report/rows.js';
import type { DemoViewRow, ViewRow, VisitRow } from './visits.js';

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

export function aDemoSite(overrides: Partial<DemoSite> = {}): DemoSite {
  return {
    slug: 'tuner',
    name: 'Tuner',
    live: 'https://tuner.najafov.dev',
    host: 'tuner.najafov.dev',
    actions: { answered: 'answered a question' },
    ...overrides,
  };
}

export function aDemoView(overrides: Partial<DemoViewRow> = {}): DemoViewRow {
  return {
    demo: 'tuner',
    createdAt: hoursAgo(1),
    path: '/',
    referrerHost: 'najafov.dev',
    ref: null,
    activeSeconds: 20,
    actions: [],
    ...overrides,
  };
}

export function aVisit(
  views: ViewRow[] = [aView()],
  overrides: Partial<Omit<VisitRow, 'views'>> = {},
): VisitRow {
  return {
    visitor: 'a visitor',
    startedAt: hoursAgo(1),
    device: 'desktop',
    browser: 'chrome',
    country: 'AZ',
    city: 'Baku',
    network: null,
    dataCenter: null,
    views,
    demoViews: [],
    ...overrides,
  };
}

export function inDataCenter(owner: string): Pick<VisitRow, 'network' | 'dataCenter'> {
  return { network: owner, dataCenter: owner };
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
    firstSeenOn: null,
    channel: 'direct',
    cvVariant: 'base',
    status: 'sent',
    answeredOn: null,
    ...overrides,
  };
}

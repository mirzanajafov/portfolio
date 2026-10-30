import type { Browser, Device } from './user-agent.js';

export const quickExitSeconds = 10;

export type ViewRow = {
  createdAt: Date;
  path: string;
  notFound: boolean;
  referrerHost: string | null;
  ref: string | null;
  activeSeconds: number;
  maxScroll: number;
  blocks: Record<string, number>;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  clicks: { href: string }[];
  errors: { message: string; source: string }[];
};

export type VisitRow = {
  startedAt: Date;
  device: Device;
  browser: Browser;
  country: string | null;
  views: ViewRow[];
};

export type Visit = VisitRow & {
  landing: ViewRow;
  exit: ViewRow;
  pages: string[];
  found: ViewRow[];
};

export function inOrder({ views, ...visit }: VisitRow): Visit[] {
  const sorted = views.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const [landing] = sorted;
  const exit = sorted.at(-1);
  if (!landing || !exit) {
    return [];
  }
  const pages = sorted
    .map(({ path }) => path)
    .filter((path, index, paths) => path !== paths[index - 1]);
  const found = sorted.filter(({ notFound }) => !notFound);
  return [{ ...visit, views: sorted, landing, exit, pages, found }];
}

export function secondsOf({ views }: Visit): number {
  return views.reduce((total, { activeSeconds }) => total + activeSeconds, 0);
}

export function isQuickExit(visit: Visit): boolean {
  return visit.pages.length === 1 && secondsOf(visit) < quickExitSeconds;
}

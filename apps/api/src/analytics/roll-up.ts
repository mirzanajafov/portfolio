import { dayTotals, type DayTotals } from './day-totals.js';
import { sourceOf, type Source } from './sources.js';
import { rankedGroups } from './statistics.js';
import type { Device } from './user-agent.js';
import { inOrder, type ViewRow, type Visit, type VisitRow } from './visits.js';

type RolledPage = {
  path: string;
  device: Device;
  views: number;
  visits: number;
  exits: number;
  notFoundViews: number;
  activeSeconds: number[];
  maxScroll: number[];
  blockSeconds: Record<string, number[]>;
  lcpMs: number[];
  inpMs: number[];
  cls: number[];
};

export type RolledDay = {
  totals: DayTotals;
  pages: RolledPage[];
  sources: { source: Source; host: string; visits: number }[];
  countries: { country: string; visits: number }[];
  clicks: { path: string; href: string; clicks: number }[];
  applications: { code: string; visits: number; views: number }[];
};

function blockSecondsOf(views: readonly ViewRow[]): Record<string, number[]> {
  const seconds: Record<string, number[]> = {};
  for (const { blocks } of views) {
    for (const [block, spent] of Object.entries(blocks)) {
      if (spent > 0) {
        (seconds[block] ??= []).push(spent);
      }
    }
  }
  return seconds;
}

function pagesOf(visits: readonly Visit[]): RolledPage[] {
  const views = visits.flatMap((visit) => visit.views.map((view) => ({ visit, view })));
  return rankedGroups(views, ({ visit, view }) => JSON.stringify([view.path, visit.device])).map(
    ([, group]) => {
      const seen = group.filter(({ view }) => !view.notFound);
      const found = seen.map(({ view }) => view);
      return {
        path: group[0].view.path,
        device: group[0].visit.device,
        views: found.length,
        visits: new Set(seen.map(({ visit }) => visit)).size,
        exits: seen.filter(({ visit, view }) => visit.exit === view).length,
        notFoundViews: group.length - found.length,
        activeSeconds: found.map(({ activeSeconds }) => activeSeconds),
        maxScroll: found.map(({ maxScroll }) => maxScroll),
        blockSeconds: blockSecondsOf(found),
        lcpMs: group.flatMap(({ view }) => view.lcpMs ?? []),
        inpMs: group.flatMap(({ view }) => view.inpMs ?? []),
        cls: group.flatMap(({ view }) => view.cls ?? []),
      };
    },
  );
}

function sourcesOf(visits: readonly Visit[]): RolledDay['sources'] {
  const landings = visits.map(({ landing, browser }) => ({
    source: sourceOf(landing.referrerHost, browser),
    host: landing.referrerHost ?? '',
  }));
  return rankedGroups(landings, ({ source, host }) => JSON.stringify([source, host])).map(
    ([, group]) => ({ ...group[0], visits: group.length }),
  );
}

function clicksOf(visits: readonly Visit[]): RolledDay['clicks'] {
  const clicks = visits.flatMap(({ views }) =>
    views.flatMap(({ path, clicks }) => clicks.map(({ href }) => ({ path, href }))),
  );
  return rankedGroups(clicks, ({ path, href }) => JSON.stringify([path, href])).map(
    ([, group]) => ({ ...group[0], clicks: group.length }),
  );
}

function applicationsOf(visits: readonly Visit[]): RolledDay['applications'] {
  const coded = visits.flatMap((visit) => {
    const code = visit.views.find(({ ref }) => ref !== null)?.ref;
    return code ? [{ code, views: visit.views.length }] : [];
  });
  return rankedGroups(coded, ({ code }) => code).map(([code, group]) => ({
    code,
    visits: group.length,
    views: group.reduce((total, { views }) => total + views, 0),
  }));
}

export function rollUp(rows: readonly VisitRow[]): RolledDay {
  const visits = rows.flatMap(inOrder);
  return {
    totals: dayTotals(visits),
    pages: pagesOf(visits),
    sources: sourcesOf(visits),
    countries: rankedGroups(visits, ({ country }) => country ?? '').map(([country, group]) => ({
      country,
      visits: group.length,
    })),
    clicks: clicksOf(visits),
    applications: applicationsOf(visits),
  };
}

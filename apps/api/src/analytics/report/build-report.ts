import type { Content } from '@portfolio/content';
import { analyticsDays, readingBlocks } from '@portfolio/content/analytics';
import { outboundLinks } from '../links.js';
import { qualityOf } from './quality.js';
import type { Report, Totals, Week } from './report.js';
import { inOrder, type ReportRows, type Visit } from './rows.js';
import { sourceOf } from './sources.js';
import { groupBy, median, tally } from './statistics.js';

const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;
const readSeconds = 2;
const quickExitSeconds = 10;
const journeyLength = 3;

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date: Date): number {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return midnight - ((date.getUTCDay() + 6) % 7) * dayMs;
}

function secondsOf({ views }: Visit): number {
  return views.reduce((total, { activeSeconds }) => total + activeSeconds, 0);
}

function startedBetween(visits: readonly Visit[], from: number, to: number): Visit[] {
  return visits.filter(({ startedAt }) => startedAt.getTime() >= from && startedAt.getTime() < to);
}

function totalsOf(visits: readonly Visit[]): Totals {
  return {
    visits: visits.length,
    pageViews: visits.reduce((total, { views }) => total + views.length, 0),
    medianVisitSeconds: median(visits.map(secondsOf)),
    phoneVisits: visits.filter(({ device }) => device === 'phone').length,
    quickExits: visits.filter(
      (visit) => visit.views.length === 1 && secondsOf(visit) < quickExitSeconds,
    ).length,
  };
}

function weeksOf(visits: readonly Visit[], kept: number, now: number): Week[] {
  const weeks: Week[] = [];
  for (let start = mondayOf(new Date(kept)); start < now; start += weekMs) {
    weeks.push({
      start: dayOf(new Date(start)),
      partial: start < kept || start + weekMs > now,
      ...totalsOf(startedBetween(visits, start, start + weekMs)),
    });
  }
  return weeks;
}

function journeyOf({ views }: Visit): string {
  return views
    .map(({ path }) => path)
    .filter((path, index, paths) => path !== paths[index - 1])
    .slice(0, journeyLength)
    .join(' ');
}

function pagesOf(visits: readonly Visit[]): Report['pages'] {
  const found = visits.flatMap(({ views }) => views.filter(({ notFound }) => !notFound));
  const visitsWith = new Map(
    tally(
      visits.flatMap(({ views }) => [
        ...new Set(views.filter(({ notFound }) => !notFound).map(({ path }) => path)),
      ]),
      (path) => path,
    ),
  );
  const exitsAt = new Map(
    tally(
      visits.filter(({ exit }) => !exit.notFound),
      ({ exit }) => exit.path,
    ),
  );
  return groupBy(found, ({ path }) => path).map(([path, views]) => ({
    path,
    views: views.length,
    visits: visitsWith.get(path) ?? 0,
    medianSeconds: median(views.map(({ activeSeconds }) => activeSeconds)),
    medianScroll: median(views.map(({ maxScroll }) => maxScroll)),
    exits: exitsAt.get(path) ?? 0,
  }));
}

function readingOf(visits: readonly Visit[], content: Content): Report['reading'] {
  const found = visits.flatMap(({ views }) => views.filter(({ notFound }) => !notFound));
  return [...readingBlocks(content)].flatMap(([path, blocks]) => {
    const views = found.filter((view) => view.path === path);
    if (views.length === 0) {
      return [];
    }
    return [
      {
        path,
        views: views.length,
        medianSeconds: median(views.map(({ activeSeconds }) => activeSeconds)),
        medianScroll: median(views.map(({ maxScroll }) => maxScroll)),
        blocks: blocks.map((block) => {
          const read = views
            .map((view) => view.blocks[block] ?? 0)
            .filter((seconds) => seconds >= readSeconds);
          return { block, readers: read.length, medianSeconds: median(read) };
        }),
      },
    ];
  });
}

function linksOf(visits: readonly Visit[], content: Content): Report['links'] {
  const labels = new Map(outboundLinks(content).map(({ href, label }) => [href, label]));
  const views = visits.flatMap(({ views }) => views);
  const clicks = views.flatMap(({ path, clicks }) => clicks.map(({ href }) => ({ path, href })));
  return {
    cvViews: views.filter(({ path }) => path === '/cv').length,
    cvPdf: tally(
      clicks.filter(({ href }) => href === '/cv.pdf'),
      ({ path }) => path,
    ).map(([from, count]) => ({ from, clicks: count })),
    outbound: tally(
      clicks.filter(({ href }) => href !== '/cv.pdf'),
      ({ href }) => labels.get(href) ?? href,
    ).map(([label, count]) => ({ label, clicks: count })),
  };
}

function askOf(questions: ReportRows['questions'], from: number, now: number): Report['ask'] {
  const asked = questions.filter(
    ({ createdAt }) => createdAt.getTime() >= from && createdAt.getTime() < now,
  );
  const refused = (rows: typeof asked) => rows.filter((row) => row.refused).length;
  return {
    questions: asked.length,
    refused: refused(asked),
    days: groupBy(asked, ({ createdAt }) => dayOf(createdAt))
      .map(([day, rows]) => ({ day, questions: rows.length, refused: refused(rows) }))
      .toSorted((a, b) => a.day.localeCompare(b.day)),
  };
}

function filterOf(dropped: ReportRows['dropped'], from: number): Report['filter'] {
  const firstDay = dayOf(new Date(from));
  const counted = (rows: typeof dropped, reason: string) =>
    rows.filter((row) => row.reason === reason).reduce((total, { count }) => total + count, 0);
  return groupBy(
    dropped.filter(({ day }) => dayOf(day) >= firstDay),
    ({ day }) => dayOf(day),
  )
    .map(([day, rows]) => ({ day, bot: counted(rows, 'bot'), limited: counted(rows, 'limited') }))
    .toSorted((a, b) => a.day.localeCompare(b.day));
}

function counted(pairs: [string, number][]): { name: string; visits: number }[] {
  return pairs.map(([name, visits]) => ({ name, visits }));
}

export function buildReport(rows: ReportRows, content: Content, now: Date, days: number): Report {
  const to = now.getTime();
  const from = to - days * dayMs;
  const previousFrom = from - days * dayMs;
  const kept = to - analyticsDays * dayMs;
  const everyVisit = rows.visits.flatMap(inOrder);
  const visits = startedBetween(everyVisit, from, to);
  const otherSites = visits.flatMap(({ landing, browser }) =>
    landing.referrerHost !== null && sourceOf(landing.referrerHost, browser) === 'other'
      ? [landing.referrerHost]
      : [],
  );
  return {
    period: { from: new Date(from), to: now, days },
    overview: {
      current: totalsOf(visits),
      previous:
        previousFrom >= kept ? totalsOf(startedBetween(everyVisit, previousFrom, from)) : null,
    },
    weeks: weeksOf(everyVisit, kept, to),
    sources: tally(visits, ({ landing, browser }) => sourceOf(landing.referrerHost, browser)).map(
      ([source, count]) => ({ source, visits: count }),
    ),
    otherSites: tally(otherSites, (host) => host).map(([host, count]) => ({ host, visits: count })),
    entries: tally(visits, ({ landing }) => landing.path).map(([path, count]) => ({
      path,
      visits: count,
    })),
    journeys: tally(visits, journeyOf).map(([journey, count]) => ({
      paths: journey.split(' '),
      visits: count,
    })),
    pages: pagesOf(visits),
    reading: readingOf(visits, content),
    links: linksOf(visits, content),
    ask: askOf(rows.questions, from, to),
    audience: {
      devices: counted(tally(visits, ({ device }) => device)),
      browsers: counted(tally(visits, ({ browser }) => browser)),
      countries: counted(tally(visits, ({ country }) => country ?? 'unknown')),
    },
    quality: qualityOf(visits),
    filter: filterOf(rows.dropped, from),
  };
}

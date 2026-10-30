import type { Content } from '@portfolio/content';
import { readingBlocks } from '@portfolio/content/analytics';
import { outboundLinks } from '../links.js';
import type { DropReason } from '../visit-log.service.js';
import { qualityOf } from './quality.js';
import { sourceOf } from '../sources.js';
import { median, rankedGroups, tally } from '../statistics.js';
import { inOrder, isQuickExit, secondsOf, type Visit } from '../visits.js';
import { readSeconds, type Report, type Totals, type Week } from './report.js';
import type { ReportRows } from './rows.js';

const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;
const journeyLength = 3;

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date: Date): number {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return midnight - ((date.getUTCDay() + 6) % 7) * dayMs;
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
    quickExits: visits.filter(isQuickExit).length,
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

function sourcesOf(visits: readonly Visit[]): Pick<Report, 'sources' | 'otherSites'> {
  const landings = visits.map(({ landing, browser }) => ({
    host: landing.referrerHost,
    source: sourceOf(landing.referrerHost, browser),
  }));
  const otherHosts = landings.flatMap(({ host, source }) =>
    source === 'other' && host !== null ? [host] : [],
  );
  return {
    sources: tally(landings, ({ source }) => source).map(([source, count]) => ({
      source,
      visits: count,
    })),
    otherSites: tally(otherHosts, (host) => host).map(([host, count]) => ({ host, visits: count })),
  };
}

function pathsOf(visits: readonly Visit[]): Pick<Report, 'entries' | 'journeys'> {
  const journeys = visits.map(({ pages }) => pages.slice(0, journeyLength));
  return {
    entries: tally(visits, ({ landing }) => landing.path).map(([path, count]) => ({
      path,
      visits: count,
    })),
    journeys: rankedGroups(journeys, (paths) => JSON.stringify(paths)).map(([, group]) => ({
      paths: group[0],
      visits: group.length,
    })),
  };
}

function pagesOf(visits: readonly Visit[]): Report['pages'] {
  const visitsWith = new Map(
    tally(
      visits.flatMap(({ found }) => [...new Set(found.map(({ path }) => path))]),
      (path) => path,
    ),
  );
  const exitsAt = new Map(
    tally(
      visits.filter(({ exit }) => !exit.notFound),
      ({ exit }) => exit.path,
    ),
  );
  return rankedGroups(
    visits.flatMap(({ found }) => found),
    ({ path }) => path,
  ).map(([path, views]) => ({
    path,
    views: views.length,
    visits: visitsWith.get(path) ?? 0,
    medianSeconds: median(views.map(({ activeSeconds }) => activeSeconds)),
    medianScroll: median(views.map(({ maxScroll }) => maxScroll)),
    exits: exitsAt.get(path) ?? 0,
  }));
}

function readingOf(visits: readonly Visit[], content: Content): Report['reading'] {
  const found = visits.flatMap(({ found }) => found);
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
    days: rankedGroups(asked, ({ createdAt }) => dayOf(createdAt))
      .map(([day, rows]) => ({ day, questions: rows.length, refused: refused(rows) }))
      .toSorted((a, b) => a.day.localeCompare(b.day)),
  };
}

function audienceOf(visits: readonly Visit[]): Report['audience'] {
  const counted = (pairs: [string, number][]) =>
    pairs.map(([name, count]) => ({ name, visits: count }));
  return {
    devices: counted(tally(visits, ({ device }) => device)),
    browsers: counted(tally(visits, ({ browser }) => browser)),
    countries: counted(tally(visits, ({ country }) => country ?? 'unknown')),
  };
}

function filterOf(dropped: ReportRows['dropped'], from: number): Report['filter'] {
  const firstDay = dayOf(new Date(from));
  const droppedFor = (rows: typeof dropped, reason: DropReason) =>
    rows.filter((row) => row.reason === reason).reduce((total, { count }) => total + count, 0);
  return rankedGroups(
    dropped.filter(({ day }) => dayOf(day) >= firstDay),
    ({ day }) => dayOf(day),
  )
    .map(([day, rows]) => ({
      day,
      bot: droppedFor(rows, 'bot'),
      limited: droppedFor(rows, 'limited'),
    }))
    .toSorted((a, b) => a.day.localeCompare(b.day));
}

export function buildReport(rows: ReportRows, content: Content, now: Date, days: number): Report {
  const to = now.getTime();
  const from = to - days * dayMs;
  const previousFrom = from - days * dayMs;
  const kept = rows.kept.getTime();
  const everyVisit = rows.visits.flatMap(inOrder);
  const visits = startedBetween(everyVisit, from, to);
  return {
    period: { from: new Date(from), to: now, days },
    overview: {
      current: totalsOf(visits),
      previous:
        previousFrom >= kept ? totalsOf(startedBetween(everyVisit, previousFrom, from)) : null,
    },
    weeks: weeksOf(everyVisit, kept, to),
    ...sourcesOf(visits),
    ...pathsOf(visits),
    pages: pagesOf(visits),
    reading: readingOf(visits, content),
    links: linksOf(visits, content),
    ask: askOf(rows.questions, from, to),
    audience: audienceOf(visits),
    quality: qualityOf(visits),
    filter: filterOf(rows.dropped, from),
  };
}

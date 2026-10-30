import type { Content } from '@portfolio/content';
import { readingBlocks } from '@portfolio/content/analytics';
import { askLogDays } from '@portfolio/content/ask';
import { outboundLinks } from '../links.js';
import { dayTotals, type DayTotals } from '../day-totals.js';
import { dayOf, daysAfter, mondayOf, utcDay } from '../days.js';
import { firstRawDay } from '../retention.js';
import { sourceOf } from '../sources.js';
import { median, rankedGroups, tally } from '../statistics.js';
import type { DropReason } from '../visit-log.service.js';
import { inOrder, type Visit } from '../visits.js';
import { applicationsOf } from './applications.js';
import { qualityOf } from './quality.js';
import { readSeconds, type Report, type Totals, type Week } from './report.js';
import type { ReportRows } from './rows.js';

const journeyLength = 3;
const trendWeeks = 12;

function firstTrendDay(now: Date): Date {
  return daysAfter(mondayOf(now), -7 * (trendWeeks - 1));
}

function firstDayBefore(now: Date, days: number): Date {
  return daysAfter(utcDay(now), -2 * days);
}

export function firstReportedDay(now: Date, days: number): Date {
  const trend = firstTrendDay(now);
  const before = firstDayBefore(now, days);
  return before < trend ? before : trend;
}

function startedBetween(visits: readonly Visit[], from: Date, to: Date): Visit[] {
  return visits.filter(({ startedAt }) => startedAt >= from && startedAt < to);
}

function sumOf(days: readonly DayTotals[]): Totals {
  const total = (count: (day: DayTotals) => number) =>
    days.reduce((sum, day) => sum + count(day), 0);
  return {
    visits: total(({ visits }) => visits),
    pageViews: total(({ pageViews }) => pageViews),
    medianVisitSeconds: median(days.flatMap(({ visitSeconds }) => visitSeconds)),
    phoneVisits: total(({ phoneVisits }) => phoneVisits),
    quickExits: total(({ quickExits }) => quickExits),
  };
}

function collected(day: DayTotals | null): day is DayTotals {
  return day !== null;
}

function weeksOf(totalsOn: (day: Date) => DayTotals | null, today: Date): Week[] {
  const weeks: Week[] = [];
  for (let start = firstTrendDay(today); start <= today; start = daysAfter(start, 7)) {
    const days = Array.from({ length: 7 }, (_, index) => daysAfter(start, index)).filter(
      (day) => day <= today,
    );
    const known = days.map(totalsOn).filter(collected);
    if (known.length > 0 || weeks.length > 0) {
      weeks.push({ start: dayOf(start), partial: known.length < 7, ...sumOf(known) });
    }
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

function linksOf(visits: readonly Visit[], labels: ReadonlyMap<string, string>): Report['links'] {
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

function askOf(questions: ReportRows['questions'], from: Date, now: Date): Report['ask'] {
  const kept = daysAfter(now, -askLogDays);
  const since = kept > from ? kept : null;
  const asked = questions.filter(
    ({ createdAt }) => createdAt >= (since ?? from) && createdAt < now,
  );
  const refused = (rows: typeof asked) => rows.filter((row) => row.refused).length;
  return {
    since,
    questions: asked.length,
    refused: refused(asked),
    days: rankedGroups(asked, ({ createdAt }) => dayOf(createdAt))
      .map(([day, rows]) => ({ day, questions: rows.length, refused: refused(rows) }))
      .toSorted((a, b) => a.day.localeCompare(b.day, 'en')),
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

function filterOf(dropped: ReportRows['dropped'], from: Date): Report['filter'] {
  const droppedFor = (rows: typeof dropped, reason: DropReason) =>
    rows.filter((row) => row.reason === reason).reduce((total, { count }) => total + count, 0);
  return rankedGroups(
    dropped.filter(({ day }) => day >= from),
    ({ day }) => dayOf(day),
  )
    .map(([day, rows]) => ({
      day,
      bot: droppedFor(rows, 'bot'),
      limited: droppedFor(rows, 'limited'),
    }))
    .toSorted((a, b) => a.day.localeCompare(b.day, 'en'));
}

export function buildReport(rows: ReportRows, content: Content, now: Date, days: number): Report {
  const today = utcDay(now);
  const from = daysAfter(today, -days);
  const everyVisit = rows.visits.flatMap(inOrder);
  const labels = new Map(outboundLinks(content).map(({ href, label }) => [href, label]));
  const visits = startedBetween(everyVisit, from, now);
  const rolled = new Map(rows.rolled.map((day) => [day.day.getTime(), day]));
  const totalsOn = (day: Date): DayTotals | null =>
    day >= rows.rawFrom
      ? dayTotals(startedBetween(everyVisit, day, daysAfter(day, 1)))
      : (rolled.get(day.getTime()) ?? null);
  const before = Array.from({ length: days }, (_, index) =>
    totalsOn(daysAfter(firstDayBefore(now, days), index)),
  );
  const firstKeptRaw = firstRawDay(now);
  return {
    period: { from, to: now, days, visits: visits.length },
    rollupBehind:
      daysAfter(rows.rawFrom, 1) < firstKeptRaw
        ? { from: dayOf(rows.rawFrom), to: dayOf(daysAfter(firstKeptRaw, -1)) }
        : null,
    overview: {
      today: sumOf([dayTotals(startedBetween(everyVisit, today, now))]),
      current: sumOf([dayTotals(startedBetween(everyVisit, from, today))]),
      previous: before.every(collected) ? sumOf(before) : null,
    },
    weeks: weeksOf(totalsOn, today),
    ...sourcesOf(visits),
    ...pathsOf(visits),
    pages: pagesOf(visits),
    reading: readingOf(visits, content),
    links: linksOf(visits, labels),
    ask: askOf(rows.questions, from, now),
    audience: audienceOf(visits),
    quality: qualityOf(visits),
    filter: filterOf(rows.dropped, from),
    applications: applicationsOf(everyVisit, rows.applications, rows.rolledApplications, labels),
  };
}

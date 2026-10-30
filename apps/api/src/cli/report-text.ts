import { geolocationCredit } from '@portfolio/content/analytics';
import { vitalBars } from '../analytics/report/quality.js';
import { dayOf } from '../analytics/days.js';
import { readSeconds, type Report, type Totals, type Vital } from '../analytics/report/report.js';
import type { Source } from '../analytics/sources.js';
import { quickExitSeconds } from '../analytics/visits.js';

const listLength = 10;
const unprintable = /[\p{Cc}\p{Cf}]/gu;
const bakuOffsetMs = 4 * 60 * 60 * 1000;

const sourceNames: Record<Source, string> = {
  google: 'Google',
  search: 'other search',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  jobs: 'job boards and ATSs',
  demos: 'my demos',
  direct: 'direct',
  other: 'other sites',
};

const lcpText = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const inpText = (ms: number) => `${String(ms)} ms`;
const clsText = (score: number) => score.toFixed(3);

function counted(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

function bakuTime(date: Date): string {
  return new Date(date.getTime() + bakuOffsetMs).toISOString().slice(0, 16).replace('T', ' ');
}

function share(part: number, whole: number): string {
  return whole === 0 ? '-' : `${String(Math.round((100 * part) / whole))}%`;
}

function optional(value: number | null, unit = ''): string {
  return value === null ? '-' : `${String(value)}${unit}`;
}

function printable(text: string): string {
  return text.replace(
    unprintable,
    (character) => `\\u{${(character.codePointAt(0) ?? 0).toString(16)}}`,
  );
}

function table(cells: readonly (readonly string[])[]): string[] {
  const rows = cells.map((row) => row.map(printable));
  const widths = rows.reduce<number[]>(
    (widest, row) => row.map((cell, column) => Math.max(widest[column] ?? 0, cell.length)),
    [],
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0),
      )
      .join('  ')
      .trimEnd(),
  );
}

function shownOf<T>(rows: readonly T[], all: boolean): readonly T[] {
  return all ? rows : rows.slice(0, listLength);
}

function section(
  title: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  all: boolean,
): string[] {
  if (rows.length === 0) {
    return [`${title}: none`];
  }
  const shown = shownOf(rows, all);
  const hidden = rows.length - shown.length;
  return [
    ...table([[title, ...columns], ...shown]),
    ...(hidden > 0 ? [`and ${String(hidden)} more, --all shows them`] : []),
  ];
}

function totalsColumn(totals: Totals): string[] {
  return [
    String(totals.visits),
    String(totals.pageViews),
    optional(totals.medianVisitSeconds),
    share(totals.phoneVisits, totals.visits),
    String(totals.quickExits),
  ];
}

function overview({ period, overview: { today, current, previous } }: Report): string[] {
  const labels = [
    'visits',
    'page views',
    'median seconds a visit',
    'on a phone',
    `one page under ${String(quickExitSeconds)} s`,
  ];
  const days = counted(period.days, 'day');
  const columns: [string, Totals][] = [
    ['today so far', today],
    [`last ${days}`, current],
  ];
  if (previous) {
    columns.push([`${days} before`, previous]);
  }
  const values = columns.map(([, totals]) => totalsColumn(totals));
  return [
    ...table([
      ['Overview', ...columns.map(([heading]) => heading)],
      ...labels.map((label, row) => [label, ...values.map((column) => column[row] ?? '')]),
    ]),
    ...(previous
      ? []
      : [`Some of the ${days} before were never collected, so there is nothing to compare with.`]),
  ];
}

function weeks({ weeks }: Report): string[] {
  return [
    ...table([
      ['Weeks from Monday, UTC', 'visits', 'page views', 'median s'],
      ...weeks.map((week) => [
        `${week.start}${week.partial ? '*' : ''}`,
        String(week.visits),
        String(week.pageViews),
        optional(week.medianVisitSeconds),
      ]),
    ]),
    '* some days of the week were never collected or have not come yet',
  ];
}

function traffic(report: Report, all: boolean): string[][] {
  const visits = report.sources.reduce((total, { visits: count }) => total + count, 0);
  return [
    section(
      'Sources',
      ['visits', 'share'],
      report.sources.map(({ source, visits: count }) => [
        sourceNames[source],
        String(count),
        share(count, visits),
      ]),
      all,
    ),
    section(
      'Other sites',
      ['visits'],
      report.otherSites.map(({ host, visits: count }) => [host, String(count)]),
      all,
    ),
    section(
      'Entry pages',
      ['visits'],
      report.entries.map(({ path, visits: count }) => [path, String(count)]),
      all,
    ),
    section(
      'First pages of a visit',
      ['visits'],
      report.journeys.map(({ paths, visits: count }) => [paths.join(' > '), String(count)]),
      all,
    ),
    section(
      'Pages',
      ['views', 'visits', 'median s', 'median scroll', 'left from here'],
      report.pages.map((page) => [
        page.path,
        String(page.views),
        String(page.visits),
        optional(page.medianSeconds),
        optional(page.medianScroll, '%'),
        share(page.exits, page.views),
      ]),
      all,
    ),
  ];
}

function reading({ reading }: Report): string[][] {
  if (reading.length === 0) {
    return [['Reading: no views of the home page or a case study']];
  }
  return reading.map((page) => [
    `Reading ${page.path}: ${counted(page.views, 'view')}, median ${optional(page.medianSeconds, ' s')}, scroll ${optional(page.medianScroll, '%')}`,
    ...table([
      ['block', `read ${String(readSeconds)} s or more`, 'median s'],
      ...page.blocks.map(({ block, readers, medianSeconds }) => [
        block,
        share(readers, page.views),
        optional(medianSeconds),
      ]),
    ]),
  ]);
}

function links({ links }: Report, all: boolean): string[][] {
  return [
    [`CV page views: ${String(links.cvViews)}`],
    section(
      'CV PDF clicks from',
      ['clicks'],
      links.cvPdf.map(({ from, clicks }) => [from, String(clicks)]),
      all,
    ),
    section(
      'Link clicks',
      ['clicks'],
      links.outbound.map(({ label, clicks }) => [label, String(clicks)]),
      all,
    ),
  ];
}

function ask({ ask }: Report): string[] {
  return [
    `Ask: ${counted(ask.questions, 'question')}, ${String(ask.refused)} refused`,
    ...(ask.days.length > 0
      ? table([
          ['UTC day', 'questions', 'refused'],
          ...ask.days.map(({ day, questions, refused }) => [
            day,
            String(questions),
            String(refused),
          ]),
        ])
      : []),
  ];
}

function audience({ audience }: Report, all: boolean): string[][] {
  const visits = audience.devices.reduce((total, { visits: count }) => total + count, 0);
  const rows = (counts: { name: string; visits: number }[]) =>
    counts.map(({ name, visits: count }) => [name, String(count), share(count, visits)]);
  return [
    section('Devices', ['visits', 'share'], rows(audience.devices), all),
    section('Browsers', ['visits', 'share'], rows(audience.browsers), all),
    section('Countries', ['visits', 'share'], rows(audience.countries), all),
  ];
}

function vital(value: Vital | null, shown: (p75: number) => string): string {
  if (value === null) {
    return '-';
  }
  const mark = value.missesMyBar ? '*' : '';
  return `${shown(value.p75)} ${value.rating}${mark} (${String(value.samples)})`;
}

function quality({ quality }: Report, all: boolean): string[][] {
  return [
    [
      ...section(
        'Web Vitals, p75 (samples)',
        ['device', 'LCP', 'INP', 'CLS'],
        quality.vitals.map(({ path, device, lcp, inp, cls }) => [
          path,
          device,
          vital(lcp, lcpText),
          vital(inp, inpText),
          vital(cls, clsText),
        ]),
        all,
      ),
      ...(shownOf(quality.vitals, all).some(({ lcp, inp, cls }) =>
        [lcp, inp, cls].some((value) => value?.missesMyBar),
      )
        ? [
            `* misses my own bar: LCP under ${lcpText(vitalBars.lcp.mine)}, INP under ${inpText(vitalBars.inp.mine)}, CLS under ${clsText(vitalBars.cls.mine)}`,
          ]
        : []),
    ],
    section(
      'Script errors',
      ['source', 'count', 'pages', 'browsers'],
      quality.errors.map((error) => [
        error.message,
        error.source,
        String(error.count),
        error.paths.join(' '),
        error.browsers.join(' '),
      ]),
      all,
    ),
    section(
      '404s',
      ['views', 'sent from'],
      quality.notFound.map(({ path, views, referrers }) => [
        path,
        String(views),
        referrers.join(' ') || '-',
      ]),
      all,
    ),
  ];
}

function filter({ filter }: Report): string[] {
  if (filter.length === 0) {
    return ['Filtered out: none'];
  }
  return table([
    ['Filtered out, UTC day', 'bots', 'limited'],
    ...filter.map(({ day, bot, limited }) => [day, String(bot), String(limited)]),
  ]);
}

export function reportText(report: Report, { all }: { all: boolean }): string {
  const { period } = report;
  const blocks = [
    [
      `Visits in the last ${counted(period.days, 'full day')} and today: ${dayOf(period.from)} to ${dayOf(period.to)} UTC, today until ${bakuTime(period.to)} Baku time`,
    ],
    ...(report.unrolledSince
      ? [
          [
            `The daily rollup is behind: visits from ${report.unrolledSince} on should have been rolled up and deleted. The API's log says why.`,
          ],
        ]
      : []),
    overview(report),
    weeks(report),
    ...traffic(report, all),
    ...reading(report),
    ...links(report, all),
    ask(report),
    ...audience(report, all),
    ...quality(report, all),
    filter(report),
    [`Countries and networks: IP Geolocation by DB-IP, ${geolocationCredit}`],
  ];
  return `${blocks.map((lines) => lines.join('\n')).join('\n\n')}\n`;
}

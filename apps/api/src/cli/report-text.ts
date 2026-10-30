import { analyticsDays, geolocationCredit } from '@portfolio/content/analytics';
import { vitalBars } from '../analytics/report/quality.js';
import type { Report, Source, Totals, Vital } from '../analytics/report/report.js';

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

const lcpText = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const inpText = (ms: number) => `${String(ms)} ms`;
const clsText = (score: number) => score.toFixed(2);

function daysText(days: number): string {
  return days === 1 ? '1 day' : `${String(days)} days`;
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

function section(
  title: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  all: boolean,
): string[] {
  if (rows.length === 0) {
    return [`${title}: none`];
  }
  const shown = all ? rows : rows.slice(0, listLength);
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

function overview({ period, overview: { current, previous } }: Report): string[] {
  const labels = [
    'visits',
    'page views',
    'median seconds a visit',
    'on a phone',
    'one page under 10 s',
  ];
  const days = daysText(period.days);
  const columns = previous
    ? [totalsColumn(current), totalsColumn(previous)]
    : [totalsColumn(current)];
  return [
    ...table([
      ['Overview', `last ${days}`, ...(previous ? [`${days} before`] : [])],
      ...labels.map((label, row) => [label, ...columns.map((column) => column[row] ?? '')]),
    ]),
    ...(previous
      ? []
      : [`The ${days} before are older than the ${String(analyticsDays)} days kept.`]),
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
    '* only part of the week is kept or has passed',
  ];
}

function traffic(report: Report, all: boolean): string[][] {
  const visits = report.overview.current.visits;
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
  return reading.map((page) => [
    `Reading ${page.path}: ${String(page.views)} views, median ${optional(page.medianSeconds, ' s')}, scroll ${optional(page.medianScroll, '%')}`,
    ...table([
      ['block', 'read 2 s or more', 'median s'],
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

function ask({ ask }: Report, all: boolean): string[] {
  return [
    `Ask: ${String(ask.questions)} questions, ${String(ask.refused)} refused`,
    ...(ask.days.length > 0
      ? section(
          'day',
          ['questions', 'refused'],
          ask.days.map(({ day, questions, refused }) => [day, String(questions), String(refused)]),
          all,
        )
      : []),
  ];
}

function audience({ audience, overview }: Report, all: boolean): string[][] {
  const visits = overview.current.visits;
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
  const mark = value.overMyBar ? '*' : '';
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
      ...(quality.vitals.length > 0
        ? [
            `* over my own bar: LCP ${lcpText(vitalBars.lcp.mine)}, INP ${inpText(vitalBars.inp.mine)}, CLS ${clsText(vitalBars.cls.mine)}`,
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

function filter({ filter }: Report, all: boolean): string[] {
  return section(
    'Filtered out',
    ['bots', 'limited'],
    filter.map(({ day, bot, limited }) => [day, String(bot), String(limited)]),
    all,
  );
}

export function reportText(report: Report, { all }: { all: boolean }): string {
  const { period } = report;
  const blocks = [
    [
      `Visits in the last ${daysText(period.days)}, ${bakuTime(period.from)} to ${bakuTime(period.to)} Baku time`,
    ],
    overview(report),
    weeks(report),
    ...traffic(report, all),
    ...reading(report),
    ...links(report, all),
    ask(report, all),
    ...audience(report, all),
    ...quality(report, all),
    filter(report, all),
    [`Countries and networks: IP Geolocation by DB-IP, ${geolocationCredit}`],
  ];
  return `${blocks.map((lines) => lines.join('\n')).join('\n\n')}\n`;
}

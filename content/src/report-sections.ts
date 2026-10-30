import { geolocationCredit } from './analytics.ts';
import {
  quickExitSeconds,
  readSeconds,
  vitalBars,
  type ApplicationEntry,
  type Confidence,
  type GuessedVisit,
  type Outcome,
  type Report,
  type Signal,
  type Source,
  type Totals,
  type Vital,
  type VisitStory,
} from './report.ts';
import { bakuTime } from './time.ts';

export type ReportPart =
  | { kind: 'line'; text: string; indent: boolean }
  | { kind: 'application'; text: string; code: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'more'; text: string; indent: boolean };

export type ReportSection = ReportPart[];

const listLength = 10;
const candidateLength = 3;
const unprintable = /[\p{Cc}\p{Cf}]/gu;

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

function printable(text: string): string {
  return text.replace(
    unprintable,
    (character) => `\\u{${(character.codePointAt(0) ?? 0).toString(16)}}`,
  );
}

function counted(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

function share(part: number, whole: number): string {
  return whole === 0 ? '-' : `${String(Math.round((100 * part) / whole))}%`;
}

function optional(value: number | null, unit = ''): string {
  return value === null ? '-' : `${String(value)}${unit}`;
}

function line(text: string): ReportPart {
  return { kind: 'line', text: printable(text), indent: false };
}

function item(text: string): ReportPart {
  return { kind: 'line', text: printable(text), indent: true };
}

function table(rows: readonly (readonly string[])[]): ReportPart {
  return { kind: 'table', rows: rows.map((row) => row.map(printable)) };
}

function more(text: string, hidden: number, indent: boolean): ReportPart[] {
  return hidden > 0 ? [{ kind: 'more', text, indent }] : [];
}

function shownOf<T>(rows: readonly T[], all: boolean): readonly T[] {
  return all ? rows : rows.slice(0, listLength);
}

function listed<T>(
  items: readonly T[],
  all: boolean,
  part: (item: T) => ReportPart[],
  indent = true,
): ReportPart[] {
  const shown = shownOf(items, all);
  const hidden = items.length - shown.length;
  return [...shown.flatMap(part), ...more(`and ${String(hidden)} more`, hidden, indent)];
}

function section(
  title: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  all: boolean,
): ReportSection {
  if (rows.length === 0) {
    return [line(`${title}: none`)];
  }
  const shown = shownOf(rows, all);
  const hidden = rows.length - shown.length;
  return [
    table([[title, ...columns], ...shown]),
    ...more(`and ${String(hidden)} more`, hidden, false),
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

function period({ period: { from, to, days } }: Report): ReportSection {
  const utc = (when: Date) => when.toISOString().slice(0, 10);
  return [
    line(
      `Visits in the last ${counted(days, 'full day')} and today: ${utc(from)} to ${utc(to)} UTC, today until ${bakuTime(to)} Baku time`,
    ),
  ];
}

function overview({ period, overview: { today, current, previous } }: Report): ReportSection {
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
    table([
      ['Overview', ...columns.map(([heading]) => heading)],
      ...labels.map((label, row) => [label, ...values.map((column) => column[row] ?? '')]),
    ]),
    ...(previous
      ? []
      : [
          line(
            `Some of the ${days} before were never collected, so there is nothing to compare with.`,
          ),
        ]),
  ];
}

function weeks({ weeks }: Report): ReportSection {
  return [
    table([
      ['Weeks from Monday, UTC', 'visits', 'page views', 'median s'],
      ...weeks.map((week) => [
        `${week.start}${week.partial ? '*' : ''}`,
        String(week.visits),
        String(week.pageViews),
        optional(week.medianVisitSeconds),
      ]),
    ]),
    line('* some days of the week were never collected or have not come yet'),
  ];
}

function traffic(report: Report, all: boolean): ReportSection[] {
  const visits = report.period.visits;
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

function reading({ reading }: Report): ReportSection[] {
  if (reading.length === 0) {
    return [[line('Reading: no views of the home page or a case study')]];
  }
  return reading.map((page) => [
    line(
      `Reading ${page.path}: ${counted(page.views, 'view')}, median ${optional(page.medianSeconds, ' s')}, scroll ${optional(page.medianScroll, '%')}`,
    ),
    table([
      ['block', `read ${String(readSeconds)} s or more`, 'median s'],
      ...page.blocks.map(({ block, readers, medianSeconds }) => [
        block,
        share(readers, page.views),
        optional(medianSeconds),
      ]),
    ]),
  ]);
}

function links({ links }: Report, all: boolean): ReportSection[] {
  return [
    [line(`CV page views: ${String(links.cvViews)}`)],
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

function ask({ ask }: Report): ReportSection {
  return [
    line(
      `Ask: ${counted(ask.questions, 'question')}, ${String(ask.refused)} refused${ask.since ? `, since ${bakuTime(ask.since)} Baku time, as far back as the log keeps them` : ''}`,
    ),
    ...(ask.days.length > 0
      ? [
          table([
            ['UTC day', 'questions', 'refused'],
            ...ask.days.map(({ day, questions, refused }) => [
              day,
              String(questions),
              String(refused),
            ]),
          ]),
        ]
      : []),
  ];
}

function audience({ audience, period }: Report, all: boolean): ReportSection[] {
  const visits = period.visits;
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

function quality({ quality }: Report, all: boolean): ReportSection[] {
  const missesMyBar = shownOf(quality.vitals, all).some(({ lcp, inp, cls }) =>
    [lcp, inp, cls].some((value) => value?.missesMyBar),
  );
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
      ...(missesMyBar
        ? [
            line(
              `* misses my own bar: LCP under ${lcpText(vitalBars.lcp.mine)}, INP under ${inpText(vitalBars.inp.mine)}, CLS under ${clsText(vitalBars.cls.mine)}`,
            ),
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

function storyText({ at, from, pages, clicks, interacted }: VisitStory): string {
  const read = pages.map(
    ({ path, seconds, read }) =>
      `${path} ${String(seconds)} s${read.length > 0 ? ` (read ${read.join(', ')})` : ''}`,
  );
  return [
    `${bakuTime(at)}${from ? `, from ${from}` : ''}: ${read.join(' > ')}`,
    ...(clicks.length > 0 ? [`clicked ${clicks.join(', ')}`] : []),
    ...(interacted ? [] : ['no interaction']),
  ].join(', ');
}

function signalText(signal: Signal): string {
  switch (signal.kind) {
    case 'network':
      return `network ${signal.name}`;
    case 'ats':
      return `from ${signal.host}`;
    case 'city':
      return signal.city;
    case 'country':
      return signal.country;
  }
}

function candidatesText(candidates: readonly { company: string; role: string }[]): string {
  const names = [
    ...new Set(
      candidates.map(({ company, role }) =>
        candidates.filter((other) => other.company === company).length > 1
          ? `${company} (${role})`
          : company,
      ),
    ),
  ];
  const named = names.slice(0, candidateLength);
  const others = names.length - named.length;
  return others > 0 ? `${named.join(', ')} or ${String(others)} more` : named.join(' or ');
}

function guessText(guess: GuessedVisit): string {
  const why = [
    ...guess.signals.map(signalText),
    `${counted(guess.daysAfter, 'day')} after applying`,
  ].join(', ');
  return `possibly ${candidatesText(guess.candidates)}, ${guess.confidence} (${why}): ${storyText(guess)}`;
}

function applicationParts(application: ApplicationEntry, all: boolean): ReportPart[] {
  const guesses = application.guesses.filter(({ confidence }) => all || confidence !== 'low');
  const lowHidden = application.guesses.length - guesses.length;
  const heading = `${application.company}, ${application.role}, applied ${application.appliedOn}, code ${application.code}`;
  const parts = [
    ...listed(application.visits, all, (visit) => [item(storyText(visit))]),
    ...listed(application.days, all, ({ day, visits, views }) => [
      item(
        `UTC day ${day}, rolled up: ${counted(visits, 'visit')}, ${counted(views, 'page view')}`,
      ),
    ]),
    ...listed(guesses, all, (guess) => [item(guessText(guess))]),
    ...more(`low guesses not shown: ${String(lowHidden)}`, lowHidden, true),
  ];
  const named = (text: string): ReportPart => ({
    kind: 'application',
    text: printable(text),
    code: application.code,
  });
  return parts.length === 0 ? [named(`${heading}: no visits yet`)] : [named(heading), ...parts];
}

function outcomesText(confidence: Confidence, outcomes: Record<Outcome, number>): string {
  return `${confidence} ${String(outcomes.right)} right, ${String(outcomes.wrong)} wrong, ${String(outcomes.tied)} tied`;
}

function applications({ applications }: Report, all: boolean): ReportSection {
  const { list, score, unknownCodes } = applications;
  const { high, medium, low } = score.levels;
  return [
    ...(list.length === 0
      ? [line('Applications: none registered')]
      : [
          line('Applications, every visit kept rather than only the period, times in Baku'),
          ...listed(list, all, (application) => applicationParts(application, all), false),
          line(
            `Guesses checked on ${counted(score.visits, 'coded visit')}: ${outcomesText('high', high)}, ${outcomesText('medium', medium)}, ${outcomesText('low', low)}, ${String(score.unplaced)} not placed`,
          ),
        ]),
    ...(unknownCodes.length > 0
      ? [
          line('Unknown codes, first seen in Baku time'),
          ...listed(unknownCodes, all, ({ code, visits, firstSeen }) => [
            item(`${code}: ${counted(visits, 'visit')}, first ${bakuTime(firstSeen)}`),
          ]),
        ]
      : []),
  ];
}

function filter({ filter }: Report): ReportSection {
  if (filter.length === 0) {
    return [line('Filtered out: none')];
  }
  return [
    table([
      ['Filtered out, UTC day', 'bots', 'limited'],
      ...filter.map(({ day, bot, limited }) => [day, String(bot), String(limited)]),
    ]),
  ];
}

export function reportSections(report: Report, { all }: { all: boolean }): ReportSection[] {
  return [
    period(report),
    ...(report.rollupBehind
      ? [
          [
            line(
              `The daily rollup is behind: the visits of ${report.rollupBehind.from} to ${report.rollupBehind.to} should have been rolled up and deleted. The API's log says why.`,
            ),
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
    applications(report, all),
    filter(report),
    [line(`Countries and networks: IP Geolocation by DB-IP, ${geolocationCredit}`)],
  ];
}

import { alertHours, analyticsDays, geolocationCredit } from './analytics.ts';
import { guessWindowDays } from './applications.ts';
import {
  quickExitSeconds,
  readSeconds,
  vitalBars,
  type ApplicationEntry,
  type ApplicationTally,
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

type Line = Extract<ReportPart, { kind: 'line' }>;

type Table = Extract<ReportPart, { kind: 'table' }>;

export type ReportSection =
  | { kind: 'titled'; id: string; label: string; opening: Line | Table; parts: ReportPart[] }
  | { kind: 'none'; text: string };

type Heading = { id: string; label: string };

const listLength = 10;
const candidateLength = 3;
const questionsInStory = 3;
const fewestForShare = 10;
const fewestAnswersForMedian = 3;
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

function line(text: string): Line {
  return { kind: 'line', text: printable(text), indent: false };
}

function none(text: string): ReportSection {
  return { kind: 'none', text: printable(text) };
}

function titled(
  { id, label }: Heading,
  opening: Line | Table,
  parts: readonly ReportPart[] = [],
): ReportSection {
  return { kind: 'titled', id, label, opening, parts: [...parts] };
}

function item(text: string): ReportPart {
  return { kind: 'line', text: printable(text), indent: true };
}

function applicationLine(text: string, code: string): ReportPart {
  return { kind: 'application', text: printable(text), code };
}

function table(rows: readonly (readonly string[])[]): Table {
  return { kind: 'table', rows: rows.map((row) => row.map(printable)) };
}

function more(text: string, hidden: number, indent: boolean): ReportPart[] {
  return hidden > 0 ? [{ kind: 'more', text, indent }] : [];
}

function shownOf<T>(rows: readonly T[], all: boolean, length = listLength): readonly T[] {
  return all ? rows : rows.slice(0, length);
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

function tableParts(
  title: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  all: boolean,
): [Table, ...ReportPart[]] {
  const shown = shownOf(rows, all);
  const hidden = rows.length - shown.length;
  return [
    table([[title, ...columns], ...shown]),
    ...more(`and ${String(hidden)} more`, hidden, false),
  ];
}

function section(
  heading: Heading,
  title: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  all: boolean,
  after: readonly ReportPart[] = [],
): ReportSection {
  if (rows.length === 0) {
    return after.length === 0
      ? none(`${title}: none`)
      : titled(heading, line(`${title}: none`), after);
  }
  const [opening, ...rest] = tableParts(title, columns, rows, all);
  return titled(heading, opening, [...rest, ...after]);
}

function totalsColumn(totals: Totals): string[] {
  return [
    String(totals.visits),
    String(totals.pageViews),
    optional(totals.medianVisitSeconds),
    share(totals.phoneVisits, totals.visits),
    String(totals.quickExits),
    String(totals.openedDemo),
    String(totals.didDemoStep),
  ];
}

function period({ period: { from, to, days, visits }, dataCenters }: Report): ReportSection {
  const utc = (when: Date) => when.toISOString().slice(0, 10);
  const dataCenterVisits = dataCenters.list.reduce((total, { visits: count }) => total + count, 0);
  return titled(
    { id: 'period', label: 'Period' },
    line(
      `Visits in the last ${counted(days, 'full day')} and today: ${utc(from)} to ${utc(to)} UTC, today until ${bakuTime(to)} Baku time`,
    ),
    [
      line(
        `${counted(visits, 'visit')} by people, ${String(dataCenterVisits)} from data centers kept apart`,
      ),
    ],
  );
}

function overview({ period, overview: { today, current, previous } }: Report): ReportSection {
  const labels = [
    'visits',
    'page views',
    'median seconds a visit',
    'on a phone',
    `one page under ${String(quickExitSeconds)} s`,
    'opened a demo',
    'did a step in one',
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
  return titled(
    { id: 'overview', label: 'Overview' },
    table([
      ['Overview', ...columns.map(([heading]) => heading)],
      ...labels.map((label, row) => [label, ...values.map((column) => column[row] ?? '')]),
    ]),
    previous
      ? []
      : [
          line(
            `Some of the ${days} before were never collected, so there is nothing to compare with.`,
          ),
        ],
  );
}

function weeks({ weeks }: Report): ReportSection {
  return titled(
    { id: 'weeks', label: 'Weeks' },
    table([
      ['Weeks from Monday, UTC', 'visits', 'page views', 'median s', 'opened a demo'],
      ...weeks.map((week) => [
        `${week.start}${week.partial ? '*' : ''}`,
        String(week.visits),
        String(week.pageViews),
        optional(week.medianVisitSeconds),
        String(week.openedDemo),
      ]),
    ]),
    [line('* some days of the week were never collected or have not come yet')],
  );
}

function traffic(report: Report, all: boolean): ReportSection[] {
  const visits = report.period.visits;
  return [
    section(
      { id: 'sources', label: 'Sources' },
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
      { id: 'other-sites', label: 'Other sites' },
      'Other sites',
      ['visits'],
      report.otherSites.map(({ host, visits: count }) => [host, String(count)]),
      all,
    ),
    section(
      { id: 'entry-pages', label: 'Entry pages' },
      'Entry pages',
      ['visits'],
      report.entries.map(({ path, visits: count }) => [path, String(count)]),
      all,
    ),
    section(
      { id: 'first-pages', label: 'First pages of a visit' },
      'First pages of a visit',
      ['visits'],
      report.journeys.map(({ paths, visits: count }) => [paths.join(' > '), String(count)]),
      all,
    ),
    section(
      { id: 'pages', label: 'Pages' },
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
    return [none('Reading: no views of the home page or a case study')];
  }
  return reading.map((page) =>
    titled(
      {
        id: page.path === '/' ? 'reading-home' : `reading${page.path.replaceAll('/', '-')}`,
        label: `Reading ${page.path}`,
      },
      line(
        `Reading ${page.path}: ${counted(page.views, 'view')}, median ${optional(page.medianSeconds, ' s')}, scroll ${optional(page.medianScroll, '%')}`,
      ),
      [
        table([
          ['block', `read ${String(readSeconds)} s or more`, 'median s'],
          ...page.blocks.map(({ block, readers, medianSeconds }) => [
            block,
            share(readers, page.views),
            optional(medianSeconds),
          ]),
        ]),
      ],
    ),
  );
}

function links({ links }: Report, all: boolean): ReportSection[] {
  return [
    titled(
      { id: 'cv-views', label: 'CV page views' },
      line(`CV page views: ${String(links.cvViews)}`),
    ),
    section(
      { id: 'cv-pdf', label: 'CV PDF clicks' },
      'CV PDF clicks from',
      ['clicks'],
      links.cvPdf.map(({ from, clicks }) => [from, String(clicks)]),
      all,
    ),
    section(
      { id: 'link-clicks', label: 'Link clicks' },
      'Link clicks',
      ['clicks'],
      links.outbound.map(({ label, clicks }) => [label, String(clicks)]),
      all,
    ),
  ];
}

function demos({ period: { visits }, demos }: Report): ReportSection {
  const { opened, didStep, demoOnly, list } = demos;
  if (list.length === 0) {
    return none('Demos: none');
  }
  return titled(
    { id: 'demos', label: 'Demos' },
    line(
      `Demos: of ${counted(visits, 'site visit')}, ${String(opened)} opened a demo (${share(opened, visits)}) and ${String(didStep)} did a step in one (${share(didStep, visits)}). ${counted(demoOnly, 'more visit')} saw only a demo.`,
    ),
    [
      table([
        [
          'Demo',
          'clicked',
          'opened in a site visit',
          'clicked, not opened',
          'only the demo',
          'did a step',
          'median s',
        ],
        ...list.map((demo) => [
          demo.name,
          String(demo.clicked),
          String(demo.fromSite),
          String(demo.clickedNotOpened),
          String(demo.demoOnly.reduce((total, { visits: count }) => total + count, 0)),
          String(demo.didStep),
          optional(demo.medianSeconds),
        ]),
      ]),
      ...list.flatMap(({ name, steps, demoOnly: arrivals }) => [
        ...(steps.length > 0
          ? [
              item(
                `${name} steps: ${steps.map(({ label, visits: count }) => `${String(count)} ${label}`).join(', ')}`,
              ),
            ]
          : []),
        ...(arrivals.length > 0
          ? [
              item(
                `${name} only the demo, from: ${arrivals.map(({ source, visits: count }) => `${sourceNames[source]} ${String(count)}`).join(', ')}`,
              ),
            ]
          : []),
      ]),
    ],
  );
}

function ask({ ask }: Report): ReportSection {
  return titled(
    { id: 'ask', label: 'Ask' },
    line(
      `Ask: ${counted(ask.questions, 'question')}, ${String(ask.refused)} refused${placedText(ask)}${ask.since ? `, since ${bakuTime(ask.since)} Baku time, as far back as the log keeps them` : ''}`,
    ),
    ask.days.length > 0
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
      : [],
  );
}

function placedText({ questions, inVisits, visits }: Report['ask']): string {
  if (questions === 0) {
    return '';
  }
  return inVisits === 0
    ? ', none of them in a visit I can see'
    : `, ${String(inVisits)} of them in ${counted(visits, 'visit')} I can see`;
}

function audience({ audience, period }: Report, all: boolean): ReportSection[] {
  const visits = period.visits;
  const rows = (counts: { name: string; visits: number }[]) =>
    counts.map(({ name, visits: count }) => [name, String(count), share(count, visits)]);
  return [
    section(
      { id: 'devices', label: 'Devices' },
      'Devices',
      ['visits', 'share'],
      rows(audience.devices),
      all,
    ),
    section(
      { id: 'browsers', label: 'Browsers' },
      'Browsers',
      ['visits', 'share'],
      rows(audience.browsers),
      all,
    ),
    section(
      { id: 'countries', label: 'Countries' },
      'Countries',
      ['visits', 'share'],
      rows(audience.countries),
      all,
    ),
  ];
}

function dataCenters({ dataCenters: { list, demoOnly } }: Report, all: boolean): ReportSection {
  const heading = { id: 'data-centers', label: 'Data centers' };
  const note = line(
    `Data-center visits are told apart only within the last ${String(analyticsDays)} days.`,
  );
  const onlyDemos = line(`${counted(demoOnly, 'data-center visit')} saw only a demo`);
  if (list.length === 0) {
    return demoOnly === 0 ? none('Data centers: none') : titled(heading, onlyDemos, [note]);
  }
  return section(
    heading,
    'Data centers',
    ['visits', 'page views', 'median s'],
    list.map(({ owner, visits, pageViews, medianSeconds }) => [
      owner,
      String(visits),
      String(pageViews),
      optional(medianSeconds),
    ]),
    all,
    [...(demoOnly > 0 ? [onlyDemos] : []), note],
  );
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
    section(
      { id: 'web-vitals', label: 'Web Vitals' },
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
      missesMyBar
        ? [
            line(
              `* misses my own bar: LCP under ${lcpText(vitalBars.lcp.mine)}, INP under ${inpText(vitalBars.inp.mine)}, CLS under ${clsText(vitalBars.cls.mine)}`,
            ),
          ]
        : [],
    ),
    section(
      { id: 'script-errors', label: 'Script errors' },
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
      { id: 'not-found', label: '404s' },
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

function storyText(
  { at, from, dataCenter, pages, clicks, questions, interacted }: VisitStory,
  all: boolean,
): string {
  const asked = shownOf(questions, all, questionsInStory);
  const unshown = questions.length - asked.length;
  const read = pages.map(({ demo, path, seconds, read, did }) => {
    const notes = [...(read.length > 0 ? [`read ${read.join(', ')}`] : []), ...did];
    return `${demo ?? ''}${path} ${String(seconds)} s${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`;
  });
  return [
    `${bakuTime(at)}${dataCenter ? ` (data center: ${dataCenter})` : ''}${from ? `, from ${from}` : ''}: ${read.join(' > ')}`,
    ...(clicks.length > 0 ? [`clicked ${clicks.join(', ')}`] : []),
    ...(questions.length > 0
      ? [
          `asked ${asked.map((question) => JSON.stringify(question)).join(', ')}${unshown > 0 ? ` and ${String(unshown)} more` : ''}`,
        ]
      : []),
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

function guessText(guess: GuessedVisit, all: boolean): string {
  const why = [
    ...guess.signals.map(signalText),
    `${counted(guess.daysAfter, 'day')} after applying`,
  ].join(', ');
  return `possibly ${candidatesText(guess.candidates)}, ${guess.confidence} (${why}): ${storyText(guess, all)}`;
}

function applicationParts(application: ApplicationEntry, all: boolean): ReportPart[] {
  const guesses = application.guesses.filter(({ confidence }) => all || confidence !== 'low');
  const lowHidden = application.guesses.length - guesses.length;
  const firstOpened = application.firstSeenOn ? `, first opened ${application.firstSeenOn}` : '';
  const answer = firstAnswerText(application.daysToAnswer);
  const heading = `${application.company}, ${application.role}, applied ${application.appliedOn}, code ${application.code}, ${application.channel}, variant ${application.cvVariant}, ${application.status}${firstOpened}${answer}`;
  const parts = [
    ...listed(application.visits, all, (visit) => [item(storyText(visit, all))]),
    ...listed(application.days, all, ({ day, visits, views }) => [
      item(
        `UTC day ${day}, rolled up: ${counted(visits, 'visit')}, ${counted(views, 'page view')}`,
      ),
    ]),
    ...listed(guesses, all, (guess) => [item(guessText(guess, all))]),
    ...more(`low guesses not shown: ${String(lowHidden)}`, lowHidden, true),
  ];
  const { code } = application;
  return parts.length === 0
    ? [applicationLine(`${heading}: no visits yet`, code)]
    : [applicationLine(heading, code), ...parts];
}

function firstAnswerText(days: number | null): string {
  if (days === null) {
    return '';
  }
  return days === 0
    ? ', first answer the same day'
    : `, first answer after ${counted(days, 'day')}`;
}

function answeredCell({ answered, oldEnough }: ApplicationTally): string {
  if (oldEnough === 0) {
    return '-';
  }
  return oldEnough < fewestForShare
    ? `${String(answered)} of ${String(oldEnough)}`
    : share(answered, oldEnough);
}

function tallyParts(
  title: string,
  tallies: readonly ApplicationTally[],
  all: boolean,
): ReportPart[] {
  if (tallies.length === 0) {
    return [line(`${title}: none`)];
  }
  return tableParts(
    title,
    [
      'applications',
      'link opened',
      `applied over ${String(guessWindowDays)} days ago`,
      'answered, of those',
      'median days to an answer',
    ],
    tallies.map((tally) => [
      tally.name,
      String(tally.applications),
      String(tally.opened),
      String(tally.oldEnough),
      answeredCell(tally),
      tally.answered < fewestAnswersForMedian ? '-' : optional(tally.medianDays),
    ]),
    all,
  );
}

function outcomesText(confidence: Confidence, outcomes: Record<Outcome, number>): string {
  return `${confidence} ${String(outcomes.right)} right, ${String(outcomes.wrong)} wrong, ${String(outcomes.tied)} tied`;
}

function applications({ applications, alerts }: Report, all: boolean): ReportSection {
  const { list, score, unknownCodes } = applications;
  const { high, medium, low } = score.levels;
  const heading = { id: 'applications', label: 'Applications' };
  const after = [
    ...(unknownCodes.length > 0
      ? [
          line('Unknown codes, first seen in Baku time'),
          ...listed(unknownCodes, all, ({ code, visits, firstSeen }) => [
            item(`${code}: ${counted(visits, 'visit')}, first ${bakuTime(firstSeen)}`),
          ]),
        ]
      : []),
    ...(alerts.givenUp > 0
      ? [
          line(
            `Telegram alerts given up in the period, not sent within ${String(alertHours)} h: ${String(alerts.givenUp)}`,
          ),
        ]
      : []),
  ];
  if (list.length === 0) {
    return after.length === 0
      ? none('Applications: none registered')
      : titled(heading, line('Applications: none registered'), after);
  }
  return titled(
    heading,
    line('Applications, every visit kept rather than only the period, times in Baku'),
    [
      ...listed(list, all, (application) => applicationParts(application, all), false),
      line(
        `Guesses checked on ${counted(score.visits, 'coded visit')} to the site by people: ${outcomesText('high', high)}, ${outcomesText('medium', medium)}, ${outcomesText('low', low)}, ${String(score.unplaced)} not placed`,
      ),
      ...tallyParts('By channel', applications.byChannel, all),
      ...tallyParts('By CV variant', applications.byVariant, all),
      ...after,
    ],
  );
}

function filter({ filter }: Report): ReportSection {
  if (filter.length === 0) {
    return none('Filtered out: none');
  }
  return titled(
    { id: 'filtered-out', label: 'Filtered out' },
    table([
      ['Filtered out, UTC day', 'bots', 'limited', 'other sites', 'mine'],
      ...filter.map(({ day, bot, limited, origin, own }) => [
        day,
        String(bot),
        String(limited),
        String(origin),
        String(own),
      ]),
    ]),
  );
}

export function reportSections(report: Report, { all }: { all: boolean }): ReportSection[] {
  return [
    period(report),
    ...(report.rollupBehind
      ? [
          titled(
            { id: 'rollup-behind', label: 'Rollup behind' },
            line(
              `The daily rollup is behind: the visits of ${report.rollupBehind.from} to ${report.rollupBehind.to} should have been rolled up and deleted. The API's log says why.`,
            ),
          ),
        ]
      : []),
    overview(report),
    weeks(report),
    ...traffic(report, all),
    ...reading(report),
    ...links(report, all),
    demos(report),
    ask(report),
    ...audience(report, all),
    dataCenters(report, all),
    ...quality(report, all),
    applications(report, all),
    filter(report),
    titled(
      { id: 'credits', label: 'Countries and networks' },
      line(`Countries and networks: IP Geolocation by DB-IP, ${geolocationCredit}`),
    ),
  ];
}

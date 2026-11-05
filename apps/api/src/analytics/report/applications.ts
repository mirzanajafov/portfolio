import type { DemoSite } from '@portfolio/content/analytics';
import {
  readSeconds,
  type GuessedVisit,
  type Outcome,
  type Report,
  type VisitStory,
} from '@portfolio/content/report';
import { dayOf } from '../days.js';
import { rankedGroups } from '../statistics.js';
import { codeOf, secondsOf, type VisitRow } from '../visits.js';
import { guesserFor, type Guess } from './guess.js';
import type { ApplicationRow, RolledApplicationDay } from './rows.js';

type Asked = ReadonlyMap<string, readonly string[]>;

type Demos = ReadonlyMap<string, DemoSite>;

type StoryPage = { at: Date; from: string | null; page: VisitStory['pages'][number] };

function pagesOf(visit: VisitRow, demos: Demos): StoryPage[] {
  const onTheSite = visit.views.map(({ createdAt, referrerHost, path, activeSeconds, blocks }) => ({
    at: createdAt,
    from: referrerHost,
    page: {
      demo: null,
      path,
      seconds: activeSeconds,
      read: Object.entries(blocks)
        .filter(([, seconds]) => seconds >= readSeconds)
        .map(([block]) => block),
      did: [],
    },
  }));
  const onDemos = visit.demoViews.map(
    ({ createdAt, referrerHost, demo, path, activeSeconds, actions }) => {
      const site = demos.get(demo);
      return {
        at: createdAt,
        from: referrerHost,
        page: {
          demo: site?.host ?? demo,
          path,
          seconds: activeSeconds,
          read: [],
          did: actions.map((action) => site?.actions[action] ?? action),
        },
      };
    },
  );
  return [...onTheSite, ...onDemos].toSorted((a, b) => a.at.getTime() - b.at.getTime());
}

function storyOf(
  visit: VisitRow,
  labels: ReadonlyMap<string, string>,
  asked: Asked,
  demos: Demos,
): VisitStory {
  const clicks = visit.views.flatMap(({ clicks }) =>
    clicks.map(({ href }) => labels.get(href) ?? href),
  );
  const questions = [...(asked.get(visit.visitor) ?? [])];
  const pages = pagesOf(visit, demos);
  const usedADemo = visit.demoViews.some(
    ({ activeSeconds, actions }) => activeSeconds > 0 || actions.length > 0,
  );
  return {
    at: visit.startedAt,
    from: pages[0]?.from ?? null,
    pages: pages.map(({ page }) => page),
    clicks,
    questions,
    interacted: secondsOf(visit) > 0 || clicks.length > 0 || questions.length > 0 || usedADemo,
  };
}

function outcomeOf(named: boolean, candidates: number): Outcome {
  if (!named) {
    return 'wrong';
  }
  return candidates === 1 ? 'right' : 'tied';
}

function scoreOf(
  coded: readonly { visit: VisitRow; application: ApplicationRow }[],
  guess: (visit: VisitRow) => Guess | null,
): Report['applications']['score'] {
  const none = (): Record<Outcome, number> => ({ right: 0, wrong: 0, tied: 0 });
  const levels = { high: none(), medium: none(), low: none() };
  let unplaced = 0;
  for (const { visit, application } of coded) {
    const guessed = guess(visit);
    if (!guessed) {
      unplaced += 1;
      continue;
    }
    const named = guessed.candidates.some(
      (candidate) => candidate.application.id === application.id,
    );
    levels[guessed.confidence][outcomeOf(named, guessed.candidates.length)] += 1;
  }
  return { visits: coded.length, unplaced, levels };
}

export function applicationsOf(
  rows: readonly VisitRow[],
  applications: readonly ApplicationRow[],
  rolled: readonly RolledApplicationDay[],
  labels: ReadonlyMap<string, string>,
  asked: Asked,
  demos: Demos,
): Report['applications'] {
  const guess = guesserFor(applications);
  const byCode = new Map(applications.map((application) => [application.code, application]));
  const newest = rows
    .toSorted((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .map((visit) => ({ visit, code: codeOf(visit) }));
  const coded = newest.flatMap(({ visit, code }) => {
    const application = code === null ? undefined : byCode.get(code);
    return application ? [{ visit, application }] : [];
  });
  const sawTheSite = ({ visit }: { visit: VisitRow }) => visit.views.length > 0;
  const guessesOf = new Map<string, GuessedVisit[]>();
  for (const { visit, code } of newest.filter(sawTheSite)) {
    const guessed = code === null ? guess(visit) : null;
    if (!guessed) {
      continue;
    }
    const candidates = guessed.candidates.map(({ application: { company, role } }) => ({
      company,
      role,
    }));
    for (const { application, signals, daysAfter } of guessed.candidates) {
      const entry = {
        ...storyOf(visit, labels, asked, demos),
        confidence: guessed.confidence,
        candidates,
        signals,
        daysAfter,
      };
      const list = guessesOf.get(application.id);
      if (list) {
        list.push(entry);
      } else {
        guessesOf.set(application.id, [entry]);
      }
    }
  }
  const unknown = newest.flatMap(({ visit, code }) =>
    code !== null && !byCode.has(code) ? [{ code, visit }] : [],
  );
  return {
    list: applications
      .toSorted(
        (a, b) =>
          b.appliedOn.getTime() - a.appliedOn.getTime() ||
          a.company.localeCompare(b.company, 'en') ||
          a.role.localeCompare(b.role, 'en'),
      )
      .map((application) => ({
        code: application.code,
        company: application.company,
        role: application.role,
        appliedOn: dayOf(application.appliedOn),
        firstSeen: application.firstSeenAt,
        visits: coded
          .filter((each) => each.application.id === application.id)
          .map(({ visit }) => storyOf(visit, labels, asked, demos)),
        days: rolled
          .filter(({ applicationId }) => applicationId === application.id)
          .toSorted((a, b) => b.day.getTime() - a.day.getTime())
          .map(({ day, visits: count, views }) => ({ day: dayOf(day), visits: count, views })),
        guesses: guessesOf.get(application.id) ?? [],
      })),
    score: scoreOf(coded.filter(sawTheSite), guess),
    unknownCodes: rankedGroups(unknown, ({ code }) => code).map(([code, group]) => ({
      code,
      visits: group.length,
      firstSeen: new Date(Math.min(...group.map(({ visit }) => visit.startedAt.getTime()))),
    })),
  };
}

import { dayOf } from '../days.js';
import { rankedGroups } from '../statistics.js';
import { codeOf, secondsOf, type Visit } from '../visits.js';
import { guesserFor, type Guess } from './guess.js';
import {
  readSeconds,
  type GuessedVisit,
  type Outcome,
  type Report,
  type VisitStory,
} from './report.js';
import type { ApplicationRow, RolledApplicationDay } from './rows.js';

function storyOf(visit: Visit, labels: ReadonlyMap<string, string>): VisitStory {
  const clicks = visit.views.flatMap(({ clicks }) =>
    clicks.map(({ href }) => labels.get(href) ?? href),
  );
  return {
    at: visit.startedAt,
    from: visit.landing.referrerHost,
    pages: visit.views.map(({ path, activeSeconds, blocks }) => ({
      path,
      seconds: activeSeconds,
      read: Object.entries(blocks)
        .filter(([, seconds]) => seconds >= readSeconds)
        .map(([block]) => block),
    })),
    clicks,
    interacted: secondsOf(visit) > 0 || clicks.length > 0,
  };
}

function outcomeOf(named: boolean, candidates: number): Outcome {
  if (!named) {
    return 'wrong';
  }
  return candidates === 1 ? 'right' : 'tied';
}

function scoreOf(
  coded: readonly { visit: Visit; application: ApplicationRow }[],
  guess: (visit: Visit) => Guess | null,
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
  visits: readonly Visit[],
  applications: readonly ApplicationRow[],
  rolled: readonly RolledApplicationDay[],
  labels: ReadonlyMap<string, string>,
): Report['applications'] {
  const guess = guesserFor(applications);
  const byCode = new Map(applications.map((application) => [application.code, application]));
  const newest = visits.toSorted((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const coded = newest.flatMap((visit) => {
    const code = codeOf(visit);
    const application = code === null ? undefined : byCode.get(code);
    return application ? [{ visit, application }] : [];
  });
  const guessesOf = new Map<string, GuessedVisit[]>();
  for (const visit of newest) {
    const guessed = codeOf(visit) === null ? guess(visit) : null;
    if (!guessed) {
      continue;
    }
    const candidates = guessed.candidates.map(({ application: { company, role } }) => ({
      company,
      role,
    }));
    for (const { application, signals, daysAfter } of guessed.candidates) {
      const entry = {
        ...storyOf(visit, labels),
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
  const unknown = newest.flatMap((visit) => {
    const code = codeOf(visit);
    return code !== null && !byCode.has(code) ? [{ code, visit }] : [];
  });
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
        visits: coded
          .filter((each) => each.application.id === application.id)
          .map(({ visit }) => storyOf(visit, labels)),
        days: rolled
          .filter(({ applicationId }) => applicationId === application.id)
          .toSorted((a, b) => b.day.getTime() - a.day.getTime())
          .map(({ day, visits: count, views }) => ({ day: dayOf(day), visits: count, views })),
        guesses: guessesOf.get(application.id) ?? [],
      })),
    score: scoreOf(coded, guess),
    unknownCodes: rankedGroups(unknown, ({ code }) => code).map(([code, group]) => ({
      code,
      visits: group.length,
      firstSeen: new Date(Math.min(...group.map(({ visit }) => visit.startedAt.getTime()))),
    })),
  };
}

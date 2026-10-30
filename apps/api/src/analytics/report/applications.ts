import { dayOf } from '../days.js';
import { rankedGroups } from '../statistics.js';
import { codeOf, secondsOf, type Visit } from '../visits.js';
import { guessOf } from './guess.js';
import { readSeconds, type Outcome, type Report, type VisitStory } from './report.js';
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
  applications: readonly ApplicationRow[],
): Report['applications']['score'] {
  const none = (): Record<Outcome, number> => ({ right: 0, wrong: 0, tied: 0 });
  const levels = { high: none(), medium: none(), low: none() };
  let unplaced = 0;
  for (const { visit, application } of coded) {
    const guess = guessOf(visit, applications);
    if (!guess) {
      unplaced += 1;
      continue;
    }
    const named = guess.candidates.some((candidate) => candidate.application.id === application.id);
    levels[guess.confidence][outcomeOf(named, guess.candidates.length)] += 1;
  }
  return { visits: coded.length, unplaced, levels };
}

export function applicationsOf(
  visits: readonly Visit[],
  applications: readonly ApplicationRow[],
  rolled: readonly RolledApplicationDay[],
  labels: ReadonlyMap<string, string>,
): Report['applications'] {
  const byCode = new Map(applications.map((application) => [application.code, application]));
  const ordered = visits.toSorted((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const coded = ordered.flatMap((visit) => {
    const code = codeOf(visit);
    const application = code === null ? undefined : byCode.get(code);
    return application ? [{ visit, application }] : [];
  });
  const guessed = ordered.flatMap((visit) => {
    const guess = codeOf(visit) === null ? guessOf(visit, applications) : null;
    return guess ? [{ visit, guess }] : [];
  });
  const unknown = ordered.flatMap((visit) => {
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
          .toSorted((a, b) => a.day.getTime() - b.day.getTime())
          .map(({ day, visits: count, views }) => ({ day: dayOf(day), visits: count, views })),
        guesses: guessed.flatMap(({ visit, guess }) => {
          const mine = guess.candidates.find(
            (candidate) => candidate.application.id === application.id,
          );
          return mine
            ? [
                {
                  ...storyOf(visit, labels),
                  confidence: guess.confidence,
                  candidates: guess.candidates.map(({ application: { company, role } }) => ({
                    company,
                    role,
                  })),
                  signals: mine.signals,
                  daysAfter: mine.daysAfter,
                },
              ]
            : [];
        }),
      })),
    score: scoreOf(coded, applications),
    unknownCodes: rankedGroups(unknown, ({ code }) => code).map(([code, group]) => ({
      code,
      visits: group.length,
      firstSeen: group[0].visit.startedAt,
    })),
  };
}

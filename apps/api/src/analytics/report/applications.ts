import { dayOf } from '../days.js';
import { rankedGroups } from '../statistics.js';
import { codeOf, secondsOf, type Visit } from '../visits.js';
import { guessOf } from './guess.js';
import { readSeconds, type Report, type VisitStory } from './report.js';
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

function withoutCode(visit: Visit): Visit {
  return { ...visit, views: visit.views.map((view) => ({ ...view, ref: null })) };
}

type Outcome = 'right' | 'wrong' | 'tied' | 'unplaced';

function scoreOf(
  coded: readonly { visit: Visit; application: ApplicationRow }[],
  applications: readonly ApplicationRow[],
): Report['applications']['score'] {
  const outcomes = coded.map(({ visit, application }): Outcome => {
    const candidates = guessOf(withoutCode(visit), applications)?.candidates ?? [];
    const named = candidates.some((candidate) => candidate.application.id === application.id);
    if (candidates.length === 0) {
      return 'unplaced';
    }
    if (!named) {
      return 'wrong';
    }
    return candidates.length === 1 ? 'right' : 'tied';
  });
  const count = (outcome: Outcome) => outcomes.filter((each) => each === outcome).length;
  return {
    visits: outcomes.length,
    right: count('right'),
    wrong: count('wrong'),
    tied: count('tied'),
    unplaced: count('unplaced'),
  };
}

export function applicationsOf(
  visits: readonly Visit[],
  applications: readonly ApplicationRow[],
  rolled: readonly RolledApplicationDay[],
  labels: ReadonlyMap<string, string>,
): Report['applications'] {
  const byCode = new Map(applications.map((application) => [application.code, application]));
  const coded = visits.flatMap((visit) => {
    const code = codeOf(visit);
    const application = code === null ? undefined : byCode.get(code);
    return application ? [{ visit, application }] : [];
  });
  const guessed = visits.flatMap((visit) => {
    const guess = guessOf(visit, applications);
    return guess ? [{ visit, guess }] : [];
  });
  const unknown = visits.flatMap((visit) => {
    const code = codeOf(visit);
    return code !== null && !byCode.has(code) ? [{ code, visit }] : [];
  });
  return {
    list: applications
      .toSorted(
        (a, b) =>
          b.appliedOn.getTime() - a.appliedOn.getTime() || a.company.localeCompare(b.company, 'en'),
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
                  companies: guess.candidates.map((candidate) => candidate.application.company),
                  reasons: mine.reasons,
                },
              ]
            : [];
        }),
      })),
    score: scoreOf(coded, applications),
    unknownCodes: rankedGroups(unknown, ({ code }) => code).map(([code, group]) => ({
      code,
      visits: group.length,
      firstSeen: new Date(Math.min(...group.map(({ visit }) => visit.startedAt.getTime()))),
    })),
  };
}

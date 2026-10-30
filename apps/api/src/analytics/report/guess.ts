import type { Confidence, Signal } from '@portfolio/content/report';
import { inBaku } from '@portfolio/content/time';
import { daysBetween } from '../days.js';
import type { Visit } from '../visits.js';
import type { ApplicationRow } from './rows.js';

type Candidate = { application: ApplicationRow; signals: Signal[]; daysAfter: number };

export type Guess = { confidence: Confidence; candidates: Candidate[] };

type Match = Candidate & { confidence: Confidence; atBest: number };

type Prepared = { application: ApplicationRow; names: string[]; city: string; atsNamed: boolean };

type Seen = { network: string[]; city: string };

const windowDays = 14;
const strength: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
const folds: Record<string, string> = { ə: 'e', ı: 'i', ø: 'o', ł: 'l', ß: 'ss', æ: 'ae', đ: 'd' };

function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[əıøłßæđ]/gu, (letter) => folds[letter] ?? letter)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function joined(text: string | null): string {
  return text === null ? '' : words(text).join('');
}

function mentions(parts: readonly string[], wanted: string): boolean {
  return (
    wanted !== '' &&
    parts.some((_, start) => {
      let run = '';
      for (const part of parts.slice(start)) {
        run += part;
        if (run.length >= wanted.length) {
          return run === wanted;
        }
      }
      return false;
    })
  );
}

function prepare(application: ApplicationRow): Prepared {
  const { networks, company, city, atsHost } = application;
  return {
    application,
    names: (networks.length > 0 ? networks : [company]).map(joined).filter(Boolean),
    city: joined(city),
    atsNamed: atsHost !== null && mentions(words(atsHost), joined(company)),
  };
}

function signalsOf(
  visit: Visit,
  seen: Seen,
  { application, names, city, atsNamed }: Prepared,
): { confidence: Confidence; signal: Signal }[] {
  const found: { confidence: Confidence; signal: Signal }[] = [];
  if (visit.network !== null && names.some((name) => mentions(seen.network, name))) {
    found.push({ confidence: 'high', signal: { kind: 'network', name: visit.network } });
  }
  const { atsHost, country } = application;
  if (atsHost !== null && visit.views.some(({ referrerHost }) => referrerHost === atsHost)) {
    found.push({
      confidence: atsNamed ? 'high' : 'medium',
      signal: { kind: 'ats', host: atsHost },
    });
  }
  const inCountry = country === null || visit.country === country;
  if (visit.city !== null && city !== '' && inCountry && seen.city === city) {
    found.push({ confidence: 'medium', signal: { kind: 'city', city: visit.city } });
  } else if (country !== null && visit.country === country) {
    found.push({ confidence: 'low', signal: { kind: 'country', country } });
  }
  return found;
}

function matchOf(visit: Visit, seen: Seen, prepared: Prepared, daysAfter: number): Match | null {
  const found = signalsOf(visit, seen, prepared);
  const best = Math.max(0, ...found.map(({ confidence }) => strength[confidence]));
  const top = found.find(({ confidence }) => strength[confidence] === best);
  return top
    ? {
        application: prepared.application,
        confidence: top.confidence,
        atBest: found.filter(({ confidence }) => strength[confidence] === best).length,
        signals: found.map(({ signal }) => signal),
        daysAfter,
      }
    : null;
}

function rank(a: Match, b: Match): number {
  return strength[b.confidence] - strength[a.confidence] || b.atBest - a.atBest;
}

export function guesserFor(
  applications: readonly ApplicationRow[],
): (visit: Visit) => Guess | null {
  const prepared = applications.map(prepare);
  return (visit) => {
    const seen = {
      network: visit.network === null ? [] : words(visit.network),
      city: joined(visit.city),
    };
    const matches = prepared
      .flatMap((each) => {
        const daysAfter = daysBetween(each.application.appliedOn, inBaku(visit.startedAt));
        if (daysAfter < 0 || daysAfter > windowDays) {
          return [];
        }
        return matchOf(visit, seen, each, daysAfter) ?? [];
      })
      .toSorted(rank);
    const [best] = matches;
    if (!best) {
      return null;
    }
    return {
      confidence: best.confidence,
      candidates: matches
        .filter((match) => rank(match, best) === 0)
        .map(({ application, signals, daysAfter }) => ({ application, signals, daysAfter })),
    };
  };
}

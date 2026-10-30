import { daysBetween, inBaku } from '../days.js';
import type { Visit } from '../visits.js';
import type { Confidence, Signal } from './report.js';
import type { ApplicationRow } from './rows.js';

type Candidate = { application: ApplicationRow; signals: Signal[]; daysAfter: number };

export type Guess = { confidence: Confidence; candidates: Candidate[] };

type Match = Candidate & { confidence: Confidence };

const windowDays = 14;
const strength: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function sameName(a: string, b: string): boolean {
  const wanted = words(b).join('');
  return wanted !== '' && words(a).join('') === wanted;
}

function mentions(text: string, name: string): boolean {
  const wanted = words(name).join('');
  const parts = words(text);
  return (
    wanted !== '' &&
    parts.some((_, start) => {
      let joined = '';
      for (const part of parts.slice(start)) {
        joined += part;
        if (joined.length >= wanted.length) {
          return joined === wanted;
        }
      }
      return false;
    })
  );
}

function matchOf(visit: Visit, application: ApplicationRow, daysAfter: number): Match | null {
  const found: { confidence: Confidence; signal: Signal }[] = [];
  const { network, city, country } = visit;
  const names = application.networks.length > 0 ? application.networks : [application.company];
  if (network !== null && names.some((name) => mentions(network, name))) {
    found.push({ confidence: 'high', signal: { kind: 'network', name: network } });
  }
  const { atsHost, city: appliedCity, country: appliedCountry } = application;
  if (atsHost !== null && visit.views.some(({ referrerHost }) => referrerHost === atsHost)) {
    found.push({
      confidence: mentions(atsHost, application.company) ? 'high' : 'medium',
      signal: { kind: 'ats', host: atsHost },
    });
  }
  const inCountry = appliedCountry === null || country === appliedCountry;
  if (appliedCity !== null && city !== null && inCountry && sameName(city, appliedCity)) {
    found.push({ confidence: 'medium', signal: { kind: 'city', city } });
  }
  if (appliedCountry !== null && country === appliedCountry) {
    found.push({ confidence: 'low', signal: { kind: 'country', country: appliedCountry } });
  }
  const [best] = found.toSorted((a, b) => strength[b.confidence] - strength[a.confidence]);
  return best
    ? {
        application,
        confidence: best.confidence,
        signals: found.map(({ signal }) => signal),
        daysAfter,
      }
    : null;
}

function rank(a: Match, b: Match): number {
  return strength[b.confidence] - strength[a.confidence] || b.signals.length - a.signals.length;
}

export function guessOf(visit: Visit, applications: readonly ApplicationRow[]): Guess | null {
  const matches = applications
    .flatMap((application) => {
      const daysAfter = daysBetween(application.appliedOn, inBaku(visit.startedAt));
      if (daysAfter < 0 || daysAfter > windowDays) {
        return [];
      }
      return matchOf(visit, application, daysAfter) ?? [];
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
}

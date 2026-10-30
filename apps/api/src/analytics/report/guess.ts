import { daysBetween } from '../days.js';
import type { Visit } from '../visits.js';

export type ApplicationRow = {
  id: string;
  code: string;
  company: string;
  role: string;
  appliedOn: Date;
  country: string | null;
  city: string | null;
  atsHost: string | null;
  networks: string[];
};

export type Confidence = 'high' | 'medium' | 'low';

export type Candidate = { application: ApplicationRow; reasons: string[] };

export type Guess = { confidence: Confidence; candidates: Candidate[] };

type Signal = { confidence: Confidence; reason: string };

const windowDays = 14;
const strength: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
const levels: Confidence[] = ['high', 'medium', 'low'];

function plain(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function signalsOf(visit: Visit, application: ApplicationRow): Signal[] {
  const signals: Signal[] = [];
  const network = plain(visit.network ?? '');
  const names = [application.company, ...application.networks].map(plain).filter(Boolean);
  if (network && names.some((name) => network.includes(name))) {
    signals.push({ confidence: 'high', reason: `network ${visit.network ?? ''}` });
  }
  const { atsHost } = application;
  if (atsHost && visit.views.some(({ referrerHost }) => referrerHost === atsHost)) {
    const named = plain(atsHost).includes(plain(application.company));
    signals.push({ confidence: named ? 'high' : 'medium', reason: `from ${atsHost}` });
  }
  if (application.city && visit.city === application.city) {
    signals.push({ confidence: 'medium', reason: application.city });
  }
  if (application.country && visit.country === application.country) {
    signals.push({ confidence: 'low', reason: application.country });
  }
  return signals;
}

export function isCoded(visit: Visit): boolean {
  return visit.views.some(({ ref }) => ref !== null);
}

export function guessOf(visit: Visit, applications: readonly ApplicationRow[]): Guess | null {
  if (isCoded(visit)) {
    return null;
  }
  const matches = applications.flatMap((application) => {
    const days = daysBetween(application.appliedOn, visit.startedAt);
    const signals = signalsOf(visit, application);
    if (days < 0 || days > windowDays || signals.length === 0) {
      return [];
    }
    const best = Math.max(...signals.map(({ confidence }) => strength[confidence]));
    const reasons = [
      ...signals.map(({ reason }) => reason),
      days === 1 ? '1 day after applying' : `${String(days)} days after applying`,
    ];
    return [{ application, best, reasons }];
  });
  const best = Math.max(0, ...matches.map((match) => match.best));
  const confidence = levels.find((level) => strength[level] === best);
  if (!confidence) {
    return null;
  }
  return {
    confidence,
    candidates: matches
      .filter((match) => match.best === best)
      .map(({ application, reasons }) => ({ application, reasons })),
  };
}

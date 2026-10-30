import { analyticsDays } from '@portfolio/content/analytics';

const dayMs = 24 * 60 * 60 * 1000;

export function keptSince(now: Date): Date {
  return new Date(now.getTime() - analyticsDays * dayMs);
}

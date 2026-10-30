import { analyticsDays, dailyTotalsMonths } from '@portfolio/content/analytics';

const dayMs = 24 * 60 * 60 * 1000;

export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function nextDay(day: Date): Date {
  return new Date(day.getTime() + dayMs);
}

export function firstRawDay(now: Date): Date {
  return utcDay(new Date(now.getTime() - analyticsDays * dayMs));
}

export function firstDailyDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - dailyTotalsMonths, now.getUTCDate()),
  );
}

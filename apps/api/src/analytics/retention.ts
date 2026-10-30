import { analyticsDays, dailyTotalsMonths } from '@portfolio/content/analytics';
import { daysAfter, utcDay } from './days.js';

export function firstRawDay(now: Date): Date {
  return daysAfter(utcDay(now), -analyticsDays);
}

export function firstDailyDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - dailyTotalsMonths, now.getUTCDate()),
  );
}

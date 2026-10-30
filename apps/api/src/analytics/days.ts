const dayMs = 24 * 60 * 60 * 1000;
const bakuOffsetMs = 4 * 60 * 60 * 1000;

export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysAfter(day: Date, count: number): Date {
  return new Date(day.getTime() + count * dayMs);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / dayMs);
}

export function mondayOf(date: Date): Date {
  return daysAfter(utcDay(date), -((date.getUTCDay() + 6) % 7));
}

export function inBaku(date: Date): Date {
  return new Date(date.getTime() + bakuOffsetMs);
}

export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

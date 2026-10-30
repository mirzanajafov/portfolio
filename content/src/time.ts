import * as z from 'zod/mini';

const bakuOffsetMs = 4 * 60 * 60 * 1000;

export const isoDate = z.pipe(
  z.iso.datetime(),
  z.transform((value: string) => new Date(value)),
);

export function inBaku(date: Date): Date {
  return new Date(date.getTime() + bakuOffsetMs);
}

export function bakuTime(date: Date): string {
  return inBaku(date).toISOString().slice(0, 16).replace('T', ' ');
}

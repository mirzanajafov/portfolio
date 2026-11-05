import { bakuTime } from '@portfolio/content/time';

export function firstVisitText(
  { company, role }: { company: string; role: string },
  firstPage: string,
  at: Date,
): string {
  return `${company}, ${role}: someone opened your link, first ${firstPage}, at ${bakuTime(at)} Baku time.`;
}

import { bakuTime } from '@portfolio/content/time';

export type FirstPage = { path: string; demoName: string | null };

export function firstVisitText(
  { company, role }: { company: string; role: string },
  { path, demoName }: FirstPage,
  at: Date,
): string {
  const first = demoName === null ? path : `the ${demoName} demo`;
  return `${company}, ${role}: someone opened your link, first ${first}, at ${bakuTime(at)} Baku time.`;
}

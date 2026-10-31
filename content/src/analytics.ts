import type { CaseStudy, Content } from './schema.ts';

export const analyticsDays = 30;
export const dailyTotalsMonths = 25;
export const backupDays = 7;
export const refCode = /^[a-z0-9]{3,16}$/;
export const hostName = /^(?=.{1,253}$)(?:[a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$/;
export const errorMessageMaxLength = 200;
export const maxSeconds = 86_400;
export const maxPathLength = 201;
export const geolocationCredit = 'https://db-ip.com';

export const webVitals = ['LCP', 'INP', 'CLS'] as const;

export type WebVital = (typeof webVitals)[number];

export type VisitEvent =
  | { type: 'view'; id: string; path: string; referrer?: string; ref?: string; notFound?: boolean }
  | {
      type: 'read';
      view: string;
      seq: number;
      activeSeconds: number;
      maxScroll: number;
      blocks: Record<string, number>;
    }
  | { type: 'click'; view: string; href: string }
  | { type: 'vital'; view: string; name: WebVital; value: number }
  | {
      type: 'error';
      view: string;
      message: string;
      source: string;
      line?: number;
      column?: number;
    };

function caseStudyBlocks({ demo, demoCaption, decisions }: CaseStudy): string[] {
  return [
    'problem',
    ...(demo && demoCaption ? ['demo'] : []),
    ...decisions.map((_, index) => `decision-${String(index + 1)}`),
    'proof',
    'next',
  ];
}

export function readingBlocks({ projects }: Content): Map<string, string[]> {
  const blocks = new Map([['/', [...projects.map(({ slug }) => slug), 'ask', 'experience']]]);
  for (const { slug, caseStudy } of projects) {
    if (caseStudy) {
      blocks.set(`/projects/${slug}`, caseStudyBlocks(caseStudy));
    }
  }
  return blocks;
}

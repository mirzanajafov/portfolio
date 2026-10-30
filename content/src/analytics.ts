export const analyticsDays = 30;
export const errorMessageMaxLength = 200;
export const maxSeconds = 86_400;
export const maxPathLength = 200;
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

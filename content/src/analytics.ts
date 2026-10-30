export const analyticsDays = 30;
export const errorMessageMaxLength = 200;

export type WebVital = 'LCP' | 'INP' | 'CLS';

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

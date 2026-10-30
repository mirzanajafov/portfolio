import type { Source } from '../sources.js';

export const readSeconds = 2;

export type Confidence = 'high' | 'medium' | 'low';

export type Signal =
  | { kind: 'network'; name: string }
  | { kind: 'ats'; host: string }
  | { kind: 'city'; city: string }
  | { kind: 'country'; country: string };

export type Outcome = 'right' | 'wrong' | 'tied';

export type Totals = {
  visits: number;
  pageViews: number;
  medianVisitSeconds: number | null;
  phoneVisits: number;
  quickExits: number;
};

export type Week = Totals & { start: string; partial: boolean };

export type VisitStory = {
  at: Date;
  from: string | null;
  pages: { path: string; seconds: number; read: string[] }[];
  clicks: string[];
  interacted: boolean;
};

export type GuessedVisit = VisitStory & {
  confidence: Confidence;
  candidates: { company: string; role: string }[];
  signals: Signal[];
  daysAfter: number;
};

export type ApplicationEntry = {
  code: string;
  company: string;
  role: string;
  appliedOn: string;
  visits: VisitStory[];
  days: { day: string; visits: number; views: number }[];
  guesses: GuessedVisit[];
};

export type Rating = 'good' | 'needs improvement' | 'poor';

export type Vital = { p75: number; samples: number; rating: Rating; missesMyBar: boolean };

export type Report = {
  period: { from: Date; to: Date; days: number; visits: number };
  rollupBehind: { from: string; to: string } | null;
  overview: { today: Totals; current: Totals; previous: Totals | null };
  weeks: Week[];
  sources: { source: Source; visits: number }[];
  otherSites: { host: string; visits: number }[];
  entries: { path: string; visits: number }[];
  journeys: { paths: string[]; visits: number }[];
  pages: {
    path: string;
    views: number;
    visits: number;
    medianSeconds: number | null;
    medianScroll: number | null;
    exits: number;
  }[];
  reading: {
    path: string;
    views: number;
    medianSeconds: number | null;
    medianScroll: number | null;
    blocks: { block: string; readers: number; medianSeconds: number | null }[];
  }[];
  links: {
    cvViews: number;
    cvPdf: { from: string; clicks: number }[];
    outbound: { label: string; clicks: number }[];
  };
  ask: {
    since: Date | null;
    questions: number;
    refused: number;
    days: { day: string; questions: number; refused: number }[];
  };
  audience: {
    devices: { name: string; visits: number }[];
    browsers: { name: string; visits: number }[];
    countries: { name: string; visits: number }[];
  };
  quality: {
    vitals: {
      path: string;
      device: string;
      lcp: Vital | null;
      inp: Vital | null;
      cls: Vital | null;
    }[];
    errors: {
      message: string;
      source: string;
      count: number;
      paths: string[];
      browsers: string[];
    }[];
    notFound: { path: string; views: number; referrers: string[] }[];
  };
  filter: { day: string; bot: number; limited: number }[];
  applications: {
    list: ApplicationEntry[];
    score: {
      visits: number;
      unplaced: number;
      levels: Record<Confidence, Record<Outcome, number>>;
    };
    unknownCodes: { code: string; visits: number; firstSeen: Date }[];
  };
};

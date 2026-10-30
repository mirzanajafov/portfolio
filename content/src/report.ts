import * as z from 'zod/mini';

export const sources = [
  'google',
  'search',
  'linkedin',
  'github',
  'jobs',
  'demos',
  'direct',
  'other',
] as const;

export type Source = (typeof sources)[number];

export const readSeconds = 2;
export const quickExitSeconds = 10;

export type Bars = { good: number; poor: number; mine: number };

export const vitalBars = {
  lcp: { good: 2500, poor: 4000, mine: 2000 },
  inp: { good: 200, poor: 500, mine: 200 },
  cls: { good: 0.1, poor: 0.25, mine: 0.05 },
} satisfies Record<string, Bars>;

const date = z.pipe(
  z.iso.datetime(),
  z.transform((value: string) => new Date(value)),
);
const day = z.string();
const named = z.object({ name: z.string(), visits: z.number() });

const totalsSchema = z.object({
  visits: z.number(),
  pageViews: z.number(),
  medianVisitSeconds: z.nullable(z.number()),
  phoneVisits: z.number(),
  quickExits: z.number(),
});

const weekSchema = z.extend(totalsSchema, { start: day, partial: z.boolean() });

const confidenceSchema = z.enum(['high', 'medium', 'low']);

const signalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('network'), name: z.string() }),
  z.object({ kind: z.literal('ats'), host: z.string() }),
  z.object({ kind: z.literal('city'), city: z.string() }),
  z.object({ kind: z.literal('country'), country: z.string() }),
]);

const outcomesSchema = z.object({ right: z.number(), wrong: z.number(), tied: z.number() });

const visitStorySchema = z.object({
  at: date,
  from: z.nullable(z.string()),
  pages: z.array(z.object({ path: z.string(), seconds: z.number(), read: z.array(z.string()) })),
  clicks: z.array(z.string()),
  interacted: z.boolean(),
});

const guessedVisitSchema = z.extend(visitStorySchema, {
  confidence: confidenceSchema,
  candidates: z.array(z.object({ company: z.string(), role: z.string() })),
  signals: z.array(signalSchema),
  daysAfter: z.number(),
});

const applicationEntrySchema = z.object({
  code: z.string(),
  company: z.string(),
  role: z.string(),
  appliedOn: day,
  visits: z.array(visitStorySchema),
  days: z.array(z.object({ day, visits: z.number(), views: z.number() })),
  guesses: z.array(guessedVisitSchema),
});

const ratingSchema = z.enum(['good', 'needs improvement', 'poor']);

const vitalSchema = z.object({
  p75: z.number(),
  samples: z.number(),
  rating: ratingSchema,
  missesMyBar: z.boolean(),
});

export const reportSchema = z.object({
  period: z.object({ from: date, to: date, days: z.number(), visits: z.number() }),
  rollupBehind: z.nullable(z.object({ from: day, to: day })),
  overview: z.object({
    today: totalsSchema,
    current: totalsSchema,
    previous: z.nullable(totalsSchema),
  }),
  weeks: z.array(weekSchema),
  sources: z.array(z.object({ source: z.enum(sources), visits: z.number() })),
  otherSites: z.array(z.object({ host: z.string(), visits: z.number() })),
  entries: z.array(z.object({ path: z.string(), visits: z.number() })),
  journeys: z.array(z.object({ paths: z.array(z.string()), visits: z.number() })),
  pages: z.array(
    z.object({
      path: z.string(),
      views: z.number(),
      visits: z.number(),
      medianSeconds: z.nullable(z.number()),
      medianScroll: z.nullable(z.number()),
      exits: z.number(),
    }),
  ),
  reading: z.array(
    z.object({
      path: z.string(),
      views: z.number(),
      medianSeconds: z.nullable(z.number()),
      medianScroll: z.nullable(z.number()),
      blocks: z.array(
        z.object({
          block: z.string(),
          readers: z.number(),
          medianSeconds: z.nullable(z.number()),
        }),
      ),
    }),
  ),
  links: z.object({
    cvViews: z.number(),
    cvPdf: z.array(z.object({ from: z.string(), clicks: z.number() })),
    outbound: z.array(z.object({ label: z.string(), clicks: z.number() })),
  }),
  ask: z.object({
    since: z.nullable(date),
    questions: z.number(),
    refused: z.number(),
    days: z.array(z.object({ day, questions: z.number(), refused: z.number() })),
  }),
  audience: z.object({
    devices: z.array(named),
    browsers: z.array(named),
    countries: z.array(named),
  }),
  quality: z.object({
    vitals: z.array(
      z.object({
        path: z.string(),
        device: z.string(),
        lcp: z.nullable(vitalSchema),
        inp: z.nullable(vitalSchema),
        cls: z.nullable(vitalSchema),
      }),
    ),
    errors: z.array(
      z.object({
        message: z.string(),
        source: z.string(),
        count: z.number(),
        paths: z.array(z.string()),
        browsers: z.array(z.string()),
      }),
    ),
    notFound: z.array(
      z.object({ path: z.string(), views: z.number(), referrers: z.array(z.string()) }),
    ),
  }),
  filter: z.array(z.object({ day, bot: z.number(), limited: z.number() })),
  applications: z.object({
    list: z.array(applicationEntrySchema),
    score: z.object({
      visits: z.number(),
      unplaced: z.number(),
      levels: z.object({ high: outcomesSchema, medium: outcomesSchema, low: outcomesSchema }),
    }),
    unknownCodes: z.array(z.object({ code: z.string(), visits: z.number(), firstSeen: date })),
  }),
});

export type Report = z.infer<typeof reportSchema>;
export type Totals = z.infer<typeof totalsSchema>;
export type Week = z.infer<typeof weekSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Outcome = keyof z.infer<typeof outcomesSchema>;
export type VisitStory = z.infer<typeof visitStorySchema>;
export type GuessedVisit = z.infer<typeof guessedVisitSchema>;
export type ApplicationEntry = z.infer<typeof applicationEntrySchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type Vital = z.infer<typeof vitalSchema>;

const bakuOffsetMs = 4 * 60 * 60 * 1000;

export function inBaku(date: Date): Date {
  return new Date(date.getTime() + bakuOffsetMs);
}

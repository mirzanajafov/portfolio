import {
  errorMessageMaxLength,
  hostName,
  maxPathLength,
  maxSeconds,
  refCode,
  webVitals,
} from '@portfolio/content/analytics';
import { z } from 'zod';

const path = z
  .string()
  .regex(new RegExp(`^/(?!/)[A-Za-z0-9._~%!$&'()*+,;=:@/-]{0,${String(maxPathLength - 1)}}$`));
const pageView = z.uuid();
const seconds = z.int().min(0).max(maxSeconds);

const view = z.strictObject({
  type: z.literal('view'),
  id: z.uuid(),
  path,
  referrer: z.string().toLowerCase().regex(hostName).optional().catch(undefined),
  ref: z.string().regex(refCode).optional().catch(undefined),
  notFound: z.boolean().default(false),
});

const read = z.strictObject({
  type: z.literal('read'),
  view: pageView,
  seq: z.int().min(1).max(10_000),
  activeSeconds: seconds,
  maxScroll: z.int().min(0).max(100),
  blocks: z
    .record(z.string().regex(/^[a-z0-9-]{1,40}$/), seconds)
    .refine((blocks) => Object.keys(blocks).length <= 30, 'at most 30 blocks'),
});

export function siteEventSchema(links: ReadonlySet<string>) {
  return z.discriminatedUnion('type', [
    view,
    read,
    z.strictObject({
      type: z.literal('click'),
      view: pageView,
      href: z.string().refine((href) => links.has(href), 'not a link the site shows'),
    }),
    z
      .strictObject({
        type: z.literal('vital'),
        view: pageView,
        name: z.enum(webVitals),
        value: z.number().min(0).max(60_000),
      })
      .refine(({ name, value }) => name !== 'CLS' || value <= 10, 'CLS is at most 10'),
    z.strictObject({
      type: z.literal('error'),
      view: pageView,
      message: z.string().max(errorMessageMaxLength),
      source: path,
      line: z.int32().min(0).optional(),
      column: z.int32().min(0).optional(),
    }),
  ]);
}

export function demoEventSchema(actions: readonly string[]) {
  return z.discriminatedUnion('type', [
    view,
    read,
    z.strictObject({
      type: z.literal('action'),
      view: pageView,
      name: z.string().refine((name) => actions.includes(name), 'not an action this demo lists'),
    }),
  ]);
}

export type SiteEventSchema = ReturnType<typeof siteEventSchema>;
export type DemoEventSchema = ReturnType<typeof demoEventSchema>;

type SiteEvent = z.infer<SiteEventSchema>;
type DemoEvent = z.infer<DemoEventSchema>;

export type AnalyticsEvent = SiteEvent | DemoEvent;

export type SourcedEvent =
  | { source: { kind: 'site' } | { kind: 'elsewhere' }; event: SiteEvent }
  | { source: { kind: 'demo'; slug: string }; event: DemoEvent };

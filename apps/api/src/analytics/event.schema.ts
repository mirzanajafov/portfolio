import {
  Inject,
  Injectable,
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import type { Content } from '@portfolio/content';
import {
  demoSites,
  errorMessageMaxLength,
  hostName,
  maxPathLength,
  maxSeconds,
  refCode,
  webVitals,
} from '@portfolio/content/analytics';
import type { Request } from 'express';
import { z } from 'zod';
import { fromSite } from '../common/caller.js';
import { parseOrRefuse } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { CONTENT } from '../content.js';
import { outboundLinks } from './links.js';

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

type SiteSchema = ReturnType<typeof siteEventSchema>;
type DemoSchema = ReturnType<typeof demoEventSchema>;

export type AnalyticsEvent = z.infer<SiteSchema> | z.infer<DemoSchema>;

type EventSource = { kind: 'site' } | { kind: 'demo'; slug: string } | { kind: 'elsewhere' };

export type SourcedEvent = { source: EventSource; event: AnalyticsEvent };

type EventRequest = { origin: string | undefined; body: unknown };

export const EventRequest = createParamDecorator(
  (_: unknown, context: ExecutionContext): EventRequest => {
    const request = context.switchToHttp().getRequest<Request>();
    const body: unknown = request.body;
    return { origin: request.get('origin'), body };
  },
);

@Injectable()
export class EventPipe implements PipeTransform<EventRequest, SourcedEvent> {
  private readonly site: SiteSchema;
  private readonly demos = new Map<string, { slug: string; schema: DemoSchema }>();

  constructor(
    @Inject(CONTENT) content: Content,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.site = siteEventSchema(new Set(outboundLinks(content).map(({ href }) => href)));
    for (const [origin, { slug, actions }] of demoSites(content)) {
      this.demos.set(origin, { slug, schema: demoEventSchema(Object.keys(actions)) });
    }
  }

  transform({ origin, body }: EventRequest): SourcedEvent {
    if (fromSite(origin, this.env.SITE_ORIGIN)) {
      return { source: { kind: 'site' }, event: parseOrRefuse(this.site, body) };
    }
    const demo = origin === undefined ? undefined : this.demos.get(origin);
    if (demo) {
      return { source: { kind: 'demo', slug: demo.slug }, event: parseOrRefuse(demo.schema, body) };
    }
    return { source: { kind: 'elsewhere' }, event: parseOrRefuse(this.site, body) };
  }
}

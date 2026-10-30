import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { CONTENT } from '../content.js';

const host = /^(?=.{1,253}$)(?:[a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$/;
const path = z.string().regex(/^\/(?!\/)[A-Za-z0-9._~%!$&'()*+,;=:@/-]{0,200}$/);
const pageView = z.uuid();
const seconds = z.int().min(0).max(86_400);

export function linksIn({ profile, projects }: Content): Set<string> {
  return new Set([
    `mailto:${profile.links.email}`,
    profile.links.github,
    profile.links.linkedin,
    '/cv.pdf',
    ...projects.flatMap(({ links, facts }) => [
      links.live,
      ...(links.repo ? [links.repo] : []),
      ...facts.flatMap(({ source }) => (source.href ? [source.href] : [])),
    ]),
  ]);
}

export function eventSchema(links: ReadonlySet<string>) {
  return z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('view'),
      id: z.uuid(),
      path,
      referrer: z.string().toLowerCase().regex(host).optional().catch(undefined),
      ref: z
        .string()
        .regex(/^[a-z0-9]{3,16}$/)
        .optional()
        .catch(undefined),
      notFound: z.boolean().default(false),
    }),
    z.strictObject({
      type: z.literal('read'),
      view: pageView,
      seq: z.int().min(1).max(10_000),
      activeSeconds: seconds,
      maxScroll: z.int().min(0).max(100),
      blocks: z
        .record(z.string().regex(/^[a-z0-9-]{1,40}$/), seconds)
        .refine((blocks) => Object.keys(blocks).length <= 30, 'at most 30 blocks'),
    }),
    z.strictObject({
      type: z.literal('click'),
      view: pageView,
      href: z.string().refine((href) => links.has(href), 'not a link the site shows'),
    }),
    z
      .strictObject({
        type: z.literal('vital'),
        view: pageView,
        name: z.enum(['LCP', 'INP', 'CLS']),
        value: z.number().min(0).max(60_000),
      })
      .refine(({ name, value }) => name !== 'CLS' || value <= 10, 'CLS is at most 10'),
    z.strictObject({
      type: z.literal('error'),
      view: pageView,
      message: z.string().max(200),
      source: z.union([z.literal('external'), path]),
      line: z.int32().min(0).optional(),
      column: z.int32().min(0).optional(),
    }),
  ]);
}

export type AnalyticsEvent = z.infer<ReturnType<typeof eventSchema>>;

@Injectable()
export class EventPipe extends ZodPipe<AnalyticsEvent> {
  constructor(@Inject(CONTENT) content: Content) {
    super(eventSchema(linksIn(content)));
  }
}

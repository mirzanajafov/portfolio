import {
  Inject,
  Injectable,
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { demoSites } from '@portfolio/content/analytics';
import type { Request } from 'express';
import { fromSite } from '../common/caller.js';
import { parseOrRefuse } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { CONTENT } from '../content.js';
import {
  demoEventSchema,
  siteEventSchema,
  type DemoEventSchema,
  type SiteEventSchema,
  type SourcedEvent,
} from './event.schema.js';
import { outboundLinks } from './links.js';

type Posted = { origin: string | undefined; body: unknown };

export const PostedEvent = createParamDecorator((_: unknown, context: ExecutionContext): Posted => {
  const request = context.switchToHttp().getRequest<Request>();
  const body: unknown = request.body;
  return { origin: request.get('origin'), body };
});

@Injectable()
export class EventPipe implements PipeTransform<Posted, SourcedEvent> {
  private readonly site: SiteEventSchema;
  private readonly demos = new Map<string, { slug: string; schema: DemoEventSchema }>();

  constructor(
    @Inject(CONTENT) content: Content,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.site = siteEventSchema(new Set(outboundLinks(content).map(({ href }) => href)));
    for (const [origin, { slug, actions }] of demoSites(content)) {
      this.demos.set(origin, { slug, schema: demoEventSchema(Object.keys(actions)) });
    }
  }

  transform({ origin, body }: Posted): SourcedEvent {
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

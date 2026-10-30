import { Inject, Injectable } from '@nestjs/common';
import { isbot } from 'isbot';
import { ClockService } from '../common/clock.service.js';
import { ENV, type Env } from '../config/env.js';
import { RateLimiterService, type Verdict } from '../rate-limit/rate-limiter.service.js';
import type { AnalyticsEvent } from './event.schema.js';
import { VisitLogService } from './visit-log.service.js';
import { keyed, networkOf } from './visitor-key.js';
import { VisitorSaltService } from './visitor-salt.service.js';

type Caller = { ip: string; userAgent: string | undefined; optedOut: boolean };

type Outcome = { kind: 'recorded' | 'ignored' } | { kind: 'limited'; retryAfterSeconds: number };

@Injectable()
export class EventsService {
  constructor(
    private readonly salts: VisitorSaltService,
    private readonly limiter: RateLimiterService,
    private readonly visits: VisitLogService,
    private readonly clock: ClockService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async accept(event: AnalyticsEvent, { ip, userAgent, optedOut }: Caller): Promise<Outcome> {
    if (optedOut) {
      return { kind: 'ignored' };
    }
    const now = this.clock.now();
    if (!userAgent || isbot(userAgent)) {
      await this.visits.countDropped('bot', now);
      return { kind: 'ignored' };
    }
    const salt = await this.salts.today();
    const network = networkOf(ip);
    const verdict = await this.admit(keyed(salt, 'limit', network));
    if (!verdict.allowed) {
      await this.visits.countDropped('limited', now);
      return { kind: 'limited', retryAfterSeconds: verdict.retryAfterSeconds };
    }
    await this.visits.record(event, { key: keyed(salt, network, userAgent), userAgent }, now);
    return { kind: 'recorded' };
  }

  private async admit(limitKey: string): Promise<Verdict> {
    const own = await this.limiter.hitAll([
      {
        key: `events:10m:${limitKey}`,
        limit: this.env.EVENTS_PER_ADDRESS_10_MIN,
        windowSeconds: 600,
      },
      {
        key: `events:day:${limitKey}`,
        limit: this.env.EVENTS_PER_ADDRESS_DAY,
        windowSeconds: 86_400,
      },
    ]);
    if (!own.allowed) {
      return own;
    }
    return this.limiter.hitAll([
      { key: 'events:day:everyone', limit: this.env.EVENTS_PER_DAY, windowSeconds: 86_400 },
    ]);
  }
}

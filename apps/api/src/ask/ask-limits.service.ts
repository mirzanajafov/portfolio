import { Inject, Injectable } from '@nestjs/common';
import { VisitorSaltService } from '../analytics/visitor-salt.service.js';
import { ENV, type Env } from '../config/env.js';
import { RateLimiterService, type Verdict } from '../rate-limit/rate-limiter.service.js';

@Injectable()
export class AskLimitsService {
  constructor(
    private readonly limiter: RateLimiterService,
    private readonly salts: VisitorSaltService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async admit(ip: string, now: Date): Promise<Verdict> {
    const client = await this.salts.limitKey(ip, now);
    return this.limiter.admit(
      [
        { key: `ask:10m:${client}`, limit: this.env.ASK_PER_CLIENT_10_MIN, windowSeconds: 600 },
        { key: `ask:day:${client}`, limit: this.env.ASK_PER_CLIENT_DAY, windowSeconds: 86_400 },
      ],
      [{ key: 'ask:day:everyone', limit: this.env.ASK_PER_DAY, windowSeconds: 86_400 }],
    );
  }
}

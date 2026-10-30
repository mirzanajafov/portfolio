import { Inject, Injectable } from '@nestjs/common';
import { clientKey } from '../common/client-key.js';
import { ClockService } from '../common/clock.service.js';
import { ENV, type Env } from '../config/env.js';
import { RateLimiterService, type Verdict } from '../rate-limit/rate-limiter.service.js';

@Injectable()
export class AskLimitsService {
  constructor(
    private readonly limiter: RateLimiterService,
    private readonly clock: ClockService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  clientOf(ip: string): string {
    return clientKey(ip, this.env.CLIENT_HASH_SECRET, this.clock.now());
  }

  async admit(client: string): Promise<Verdict> {
    return this.limiter.admit(
      [
        { key: `ask:10m:${client}`, limit: this.env.ASK_PER_CLIENT_10_MIN, windowSeconds: 600 },
        { key: `ask:day:${client}`, limit: this.env.ASK_PER_CLIENT_DAY, windowSeconds: 86_400 },
      ],
      [{ key: 'ask:day:everyone', limit: this.env.ASK_PER_DAY, windowSeconds: 86_400 }],
    );
  }
}

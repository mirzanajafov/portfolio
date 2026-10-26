import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../common/clock.service.js';
import { ENV, type Env } from '../config/env.js';
import { RateLimiter, type Verdict } from '../rate-limit/rate-limiter.service.js';
import { clientKey } from './client-key.js';

@Injectable()
export class AskLimits {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  callerOf(ip: string): string {
    return clientKey(ip, this.env.CLIENT_HASH_SECRET, this.clock.now());
  }

  admit(caller: string): Promise<Verdict> {
    return this.limiter.hitAll([
      { key: `ask:10m:${caller}`, limit: this.env.ASK_PER_CLIENT_10_MIN, windowSeconds: 600 },
      { key: `ask:day:${caller}`, limit: this.env.ASK_PER_CLIENT_DAY, windowSeconds: 86_400 },
      { key: 'ask:day:everyone', limit: this.env.ASK_PER_DAY, windowSeconds: 86_400 },
    ]);
  }
}

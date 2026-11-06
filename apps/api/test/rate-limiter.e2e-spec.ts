import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RateLimiterService } from '../src/rate-limit/rate-limiter.service.js';
import { FixedClock, startApp } from './start-app.js';

describe('the rate limiter against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;
  let limiter: RateLimiterService;

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
    limiter = app.get(RateLimiterService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.current = new Date('2026-10-02T12:00:00Z');
    await prisma.$executeRaw`TRUNCATE "RateLimit"`;
  });

  it('waits for the longest window a request goes over, in whichever order the limits come', async () => {
    const day = { key: 'test:day', limit: 1, windowSeconds: 86_400 };
    const tenMinutes = { key: 'test:10m', limit: 1, windowSeconds: 600 };

    expect(await limiter.admit([day, tenMinutes], [])).toEqual({ kind: 'allowed' });
    expect(await limiter.admit([day, tenMinutes], [])).toEqual({
      kind: 'limited',
      retryAfterSeconds: 12 * 60 * 60,
    });
    expect(await limiter.admit([tenMinutes, day], [])).toEqual({
      kind: 'limited',
      retryAfterSeconds: 12 * 60 * 60,
    });
  });
});

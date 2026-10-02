import { Global, Module } from '@nestjs/common';
import { Clock } from './common/clock.js';
import { ENV, parseEnv } from './config/env.js';
import { RateLimiter } from './limits/rate-limiter.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => parseEnv(process.env) },
    Clock,
    PrismaService,
    RateLimiter,
  ],
  exports: [ENV, Clock, PrismaService, RateLimiter],
})
export class CoreModule {}

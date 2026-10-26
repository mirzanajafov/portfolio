import { Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter.service.js';

@Module({
  providers: [RateLimiter],
  exports: [RateLimiter],
})
export class RateLimitModule {}

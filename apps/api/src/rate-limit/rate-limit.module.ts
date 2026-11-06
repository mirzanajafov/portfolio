import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RateLimiterService } from './rate-limiter.service.js';
import { TooManyRequestsFilter } from './too-many-requests.filter.js';

@Module({
  providers: [RateLimiterService, { provide: APP_FILTER, useClass: TooManyRequestsFilter }],
  exports: [RateLimiterService],
})
export class RateLimitModule {}

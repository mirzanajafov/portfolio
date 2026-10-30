import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { VisitLogService } from './visit-log.service.js';
import { VisitorSaltService } from './visitor-salt.service.js';

@Module({
  imports: [RateLimitModule],
  controllers: [EventsController],
  providers: [EventsService, VisitLogService, VisitorSaltService],
})
export class AnalyticsModule {}

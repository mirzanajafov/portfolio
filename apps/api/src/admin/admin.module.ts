import { Module } from '@nestjs/common';
import { AnalyticsReportModule } from '../analytics/report/analytics-report.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { VisitorSaltModule } from '../analytics/visitor-salt.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [RateLimitModule, VisitorSaltModule, AnalyticsReportModule, ApplicationsModule],
  controllers: [AdminController],
  providers: [AdminSessionsService],
  exports: [AdminSessionsService],
})
export class AdminModule {}

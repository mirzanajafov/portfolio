import { Module } from '@nestjs/common';
import { AnalyticsReportService } from './analytics-report.service.js';

@Module({
  providers: [AnalyticsReportService],
  exports: [AnalyticsReportService],
})
export class AnalyticsReportModule {}

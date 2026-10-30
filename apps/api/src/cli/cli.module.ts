import { Module } from '@nestjs/common';
import { AnalyticsReportModule } from '../analytics/report/analytics-report.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { CoreModule } from '../core.module.js';

@Module({
  imports: [CoreModule, ApplicationsModule, AnalyticsReportModule],
})
export class CliModule {}

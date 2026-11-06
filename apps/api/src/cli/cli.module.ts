import { Module } from '@nestjs/common';
import { AdminSessionsModule } from '../admin/admin-sessions.module.js';
import { AnalyticsReportModule } from '../analytics/report/analytics-report.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { CoreModule } from '../core.module.js';

@Module({
  imports: [CoreModule, ApplicationsModule, AnalyticsReportModule, AdminSessionsModule],
})
export class CliModule {}

import { Module } from '@nestjs/common';
import { AdminSessionsModule } from '../admin-sessions/admin-sessions.module.js';
import { AnalyticsReportModule } from '../analytics/report/analytics-report.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AdminApplicationsController } from './admin-applications.controller.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [AdminSessionsModule, AnalyticsReportModule, ApplicationsModule],
  controllers: [AdminController, AdminApplicationsController],
})
export class AdminModule {}

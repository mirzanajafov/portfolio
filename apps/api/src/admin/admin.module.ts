import { Module } from '@nestjs/common';
import { AnalyticsReportModule } from '../analytics/report/analytics-report.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { AdminApplicationsController } from './admin-applications.controller.js';
import { AdminSessionsModule } from './admin-sessions.module.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [AdminSessionsModule, AnalyticsReportModule, ApplicationsModule],
  controllers: [AdminController, AdminApplicationsController],
})
export class AdminModule {}

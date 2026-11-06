import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminModule } from './admin/admin.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AskModule } from './ask/ask.module.js';
import { TooManyRequestsFilter } from './common/too-many-requests.filter.js';
import { CoreModule } from './core.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [CoreModule, HealthModule, AskModule, AnalyticsModule, AdminModule],
  providers: [{ provide: APP_FILTER, useClass: TooManyRequestsFilter }],
})
export class AppModule {}

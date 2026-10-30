import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AskModule } from './ask/ask.module.js';
import { CoreModule } from './core.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [CoreModule, HealthModule, AskModule, AnalyticsModule],
})
export class AppModule {}

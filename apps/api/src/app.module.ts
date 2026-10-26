import { Module } from '@nestjs/common';
import { AskModule } from './ask/ask.module.js';
import { CoreModule } from './core.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [CoreModule, HealthModule, AskModule],
})
export class AppModule {}

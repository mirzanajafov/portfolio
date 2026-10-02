import { Module } from '@nestjs/common';
import { AskModule } from './ask/ask.module.js';
import { CoreModule } from './core.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [CoreModule, AskModule],
  controllers: [HealthController],
})
export class AppModule {}

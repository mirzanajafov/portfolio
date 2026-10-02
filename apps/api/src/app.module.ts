import { Module } from '@nestjs/common';
import { AskModule } from './ask/ask.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [AskModule],
  controllers: [HealthController],
})
export class AppModule {}

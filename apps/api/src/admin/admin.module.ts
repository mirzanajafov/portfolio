import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [RateLimitModule],
  controllers: [AdminController],
  providers: [AdminSessionsService],
  exports: [AdminSessionsService],
})
export class AdminModule {}

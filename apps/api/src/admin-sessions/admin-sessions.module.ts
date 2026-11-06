import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { VisitorSaltModule } from '../visitor-keys/visitor-salt.module.js';
import { AdminSessionsService } from './admin-sessions.service.js';

@Module({
  imports: [RateLimitModule, VisitorSaltModule],
  providers: [AdminSessionsService],
  exports: [AdminSessionsService],
})
export class AdminSessionsModule {}

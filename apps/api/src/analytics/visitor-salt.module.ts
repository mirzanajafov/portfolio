import { Module } from '@nestjs/common';
import { VisitorSaltService } from './visitor-salt.service.js';

@Module({
  providers: [VisitorSaltService],
  exports: [VisitorSaltService],
})
export class VisitorSaltModule {}

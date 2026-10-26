import { Global, Module } from '@nestjs/common';
import { ClockService } from './common/clock.service.js';
import { ENV, parseEnv } from './config/env.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => parseEnv(process.env) },
    ClockService,
    PrismaService,
  ],
  exports: [ENV, ClockService, PrismaService],
})
export class CoreModule {}

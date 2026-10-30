import { Global, Module } from '@nestjs/common';
import { content } from '@portfolio/content';
import { ClockService } from './common/clock.service.js';
import { ENV, parseEnv } from './config/env.js';
import { CONTENT } from './content.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => parseEnv(process.env) },
    { provide: CONTENT, useValue: content },
    ClockService,
    PrismaService,
  ],
  exports: [ENV, CONTENT, ClockService, PrismaService],
})
export class CoreModule {}

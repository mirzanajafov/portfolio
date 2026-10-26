import { Global, Module } from '@nestjs/common';
import { Clock } from './common/clock.service.js';
import { ENV, parseEnv } from './config/env.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }, Clock, PrismaService],
  exports: [ENV, Clock, PrismaService],
})
export class CoreModule {}

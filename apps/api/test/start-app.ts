import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ANSWER_ENGINE, type AnswerEngine } from '../src/ask/answer-engine.js';
import { ClockService } from '../src/common/clock.service.js';
import { ENV, parseEnv } from '../src/config/env.js';
import { CONTENT } from '../src/content.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { fixtureContent } from './content.fixture.js';

export class FixedClock extends ClockService {
  current = new Date('2026-10-02T12:00:00Z');
  override now(): Date {
    return this.current;
  }
}

export async function startApp(overrides: Record<string, string> = {}, engine?: AnswerEngine) {
  const clock = new FixedClock();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(parseEnv({ ...process.env, ...overrides }))
    .overrideProvider(ClockService)
    .useValue(clock)
    .overrideProvider(CONTENT)
    .useValue(fixtureContent);
  if (engine) {
    builder = builder.overrideProvider(ANSWER_ENGINE).useValue(engine);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, clock, prisma: app.get(PrismaService) };
}

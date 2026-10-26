import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

let app: NestExpressApplication | undefined;

async function startWith(database: { $queryRaw: () => Promise<unknown> }) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: database }],
  }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  await app.init();
  return app;
}

afterEach(async () => {
  await app?.close();
});

describe('GET /health', () => {
  it('answers ok when the database answers', async () => {
    const started = await startWith({ $queryRaw: () => Promise.resolve([{ '?column?': 1 }]) });
    await request(started.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('answers 503 when the database does not, so a deploy rolls back instead of going live', async () => {
    const started = await startWith({ $queryRaw: () => Promise.reject(new Error('refused')) });
    await request(started.getHttpServer()).get('/health').expect(503);
  });
});

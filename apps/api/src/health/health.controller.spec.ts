import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

async function startWith(database: { $queryRaw: () => Promise<unknown> }) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: database }],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  await app.init();
  onTestFinished(() => app.close());
  return app;
}

describe('GET /health', () => {
  it('answers ok when the database answers', async () => {
    const app = await startWith({ $queryRaw: () => Promise.resolve([{ '?column?': 1 }]) });
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('answers 503 when the database does not, so a deploy rolls back instead of going live', async () => {
    const app = await startWith({ $queryRaw: () => Promise.reject(new Error('refused')) });
    await request(app.getHttpServer()).get('/health').expect(503);
  });

  it('logs why the database did not answer, since the 503 itself is not logged', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    onTestFinished(() => {
      warn.mockRestore();
    });
    const app = await startWith({ $queryRaw: () => Promise.reject(new Error('refused')) });
    await request(app.getHttpServer()).get('/health').expect(503);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused'));
  });
});

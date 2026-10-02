import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';

function parseEvents(body: string): { event: string; data: unknown }[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? '';
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null') as unknown;
      return { event, data };
    });
}

describe('POST /ask', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams an answer as server-sent events, with the source of every sentence', async () => {
    const response = await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 'How does Matchium pick which questions to ask?' })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);
    const events = parseEvents(response.text);
    expect(events[0]).toEqual({ event: 'meta', data: { type: 'meta', engine: 'keyword' } });
    expect(events.at(-1)).toEqual({ event: 'done', data: { type: 'done' } });
    const first = events.find((e) => e.event === 'sentence')?.data as {
      sources: { id: string; href?: string }[];
    };
    expect(first.sources[0]).toEqual(
      expect.objectContaining({
        id: 'matchium/half-the-questions',
        href: 'https://github.com/mirzanajafov/matchium/blob/main/README.md',
      }),
    );
  });

  it('never links into a private repo', async () => {
    const response = await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 'How does cancelling a request work in TM Post?' })
      .expect(200);
    const sentence = parseEvents(response.text).find((e) => e.event === 'sentence')?.data as {
      sources: { id: string; href?: string }[];
    };
    expect(sentence.sources[0]?.id).toBe('tm-post/cancel-latency');
    expect(sentence.sources[0]?.href).toBeUndefined();
  });

  const invalid: [object, string][] = [
    [{}, 'no question'],
    [{ question: '   ' }, 'a blank question'],
    [{ question: 'x'.repeat(301) }, 'a question over 300 characters'],
    [{ question: 'hi', extra: true }, 'unexpected fields'],
  ];

  it.each(invalid)('rejects %j (%s)', async (body) => {
    await request(app.getHttpServer()).post('/ask').send(body).expect(400);
  });
});

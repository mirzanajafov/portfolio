import { createServer, type Socket } from 'node:net';
import request from 'supertest';
import { assert, describe, expect, it, onTestFinished } from 'vitest';
import { startApp } from './start-app.js';

const loginAcceptedAndReady = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0, 0x5a, 0, 0, 0, 5, 0x49]);

async function stalledDatabase(stallsWhile: 'connecting' | 'querying') {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    if (stallsWhile === 'querying') {
      socket.once('data', () => socket.write(loginAcceptedAndReady));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address !== null && typeof address === 'object');
  onTestFinished(() => {
    for (const socket of sockets) {
      socket.destroy();
    }
    server.close();
  });
  return `postgresql://portfolio:portfolio@127.0.0.1:${address.port}/portfolio`;
}

describe('GET /health', () => {
  it('reports healthy while the database answers', async () => {
    const { app } = await startApp();
    onTestFinished(() => app.close());
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it.each(['connecting', 'querying'] as const)(
    'answers 503 within seconds when the database stops answering while %s',
    async (stallsWhile) => {
      const { app } = await startApp({ DATABASE_URL: await stalledDatabase(stallsWhile) });
      onTestFinished(() => app.close());
      const started = performance.now();
      await request(app.getHttpServer()).get('/health').expect(503);
      expect(performance.now() - started).toBeLessThan(10_000);
    },
    20_000,
  );
});

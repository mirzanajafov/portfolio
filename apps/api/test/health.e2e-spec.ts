import { createServer, type Socket } from 'node:net';
import request from 'supertest';
import { assert, describe, expect, it, onTestFinished } from 'vitest';
import { startApp } from './start-app.js';

async function silentDatabase() {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => sockets.add(socket));
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

  it('answers 503 within seconds when the database stops answering', async () => {
    const { app } = await startApp({ DATABASE_URL: await silentDatabase() });
    onTestFinished(() => app.close());
    const started = performance.now();
    await request(app.getHttpServer()).get('/health').expect(503);
    expect(performance.now() - started).toBeLessThan(10_000);
  }, 20_000);
});

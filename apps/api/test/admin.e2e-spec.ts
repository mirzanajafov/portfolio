import type { NestExpressApplication } from '@nestjs/platform-express';
import { adminSignInSchema } from '@portfolio/content/admin';
import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminSessionsService } from '../src/admin/admin-sessions.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { address } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

const start = new Date('2026-10-02T12:00:00Z');

const later = (ms: number) => new Date(start.getTime() + ms);

const minutes = (count: number) => count * 60 * 1000;

const days = (count: number) => count * 24 * 60 * 60 * 1000;

const unknownToken = () => randomBytes(32).toString('base64url');

describe('admin sign-in against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;
  let sessions: AdminSessionsService;

  const signIn = (token: string, forwardedFor = address) =>
    request(app.getHttpServer())
      .post('/admin/sessions')
      .set('X-Forwarded-For', forwardedFor)
      .send({ token });

  const session = (authorization?: string) => {
    const call = request(app.getHttpServer()).get('/admin/session');
    return authorization === undefined ? call : call.set('Authorization', authorization);
  };

  const signOut = (token: string) =>
    request(app.getHttpServer()).delete('/admin/session').set('Authorization', `Bearer ${token}`);

  const sessionFrom = async (link: string): Promise<string> => {
    return adminSignInSchema.parse((await signIn(link).expect(201)).body).token;
  };

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
    sessions = app.get(AdminSessionsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.current = start;
    await prisma.$executeRaw`TRUNCATE "AdminLoginToken", "AdminSession", "RateLimit"`;
  });

  it('starts a 30-day session from a link once, and then answers that link like an unknown one', async () => {
    const link = await sessions.link();

    const { token, expiresAt } = adminSignInSchema.parse((await signIn(link).expect(201)).body);
    expect(expiresAt).toBe(later(days(30)).toISOString());
    expect((await session(`Bearer ${token}`).expect(200)).body).toEqual({
      expiresAt: later(days(30)).toISOString(),
    });

    const used = await signIn(link).expect(404);
    const unknown = await signIn(unknownToken()).expect(404);
    expect(used.body).toEqual(unknown.body);
  });

  it('starts one session when the same link is spent twice at once', async () => {
    const link = await sessions.link();

    const statuses = (await Promise.all([signIn(link), signIn(link)])).map(({ status }) => status);

    expect(statuses.sort()).toEqual([201, 404]);
    expect(await prisma.adminSession.count()).toBe(1);
  });

  it('takes a link in its tenth minute and refuses it from the eleventh', async () => {
    const early = await sessions.link();
    const late = await sessions.link();

    clock.current = later(minutes(10) - 1000);
    await signIn(early).expect(201);
    clock.current = later(minutes(10));
    await signIn(late).expect(404);
  });

  it('lets neither kind of token stand in for the other', async () => {
    const link = await sessions.link();
    const token = await sessionFrom(await sessions.link());

    await session(`Bearer ${link}`).expect(404);
    await signIn(token).expect(404);
    await signIn(link).expect(201);
  });

  it('stores only the SHA-256 of each token', async () => {
    const link = await sessions.link();
    const token = await sessionFrom(await sessions.link());
    const sha256 = (value: string) => createHash('sha256').update(value).digest();

    expect((await prisma.adminLoginToken.findMany()).map(({ hash }) => hash)).toEqual([
      new Uint8Array(sha256(link)),
    ]);
    expect((await prisma.adminSession.findMany()).map(({ hash }) => hash)).toEqual([
      new Uint8Array(sha256(token)),
    ]);
  });

  it.each([
    ['no Authorization header', undefined],
    ['another scheme', `Basic ${unknownToken()}`],
    ['a malformed token', 'Bearer short'],
    ['an unknown token', `Bearer ${unknownToken()}`],
  ])('answers 404 to %s', async (_, authorization) => {
    await sessionFrom(await sessions.link());
    await session(authorization).expect(404);
  });

  it('ends a session when it signs out', async () => {
    const token = await sessionFrom(await sessions.link());
    const other = await sessionFrom(await sessions.link());

    await signOut(token).expect(204);
    await session(`Bearer ${token}`).expect(404);
    await signOut(token).expect(404);
    await session(`Bearer ${other}`).expect(200);
  });

  it('ends a session after 30 days, however often it was used', async () => {
    const token = await sessionFrom(await sessions.link());

    clock.current = later(days(30) - 1000);
    await session(`Bearer ${token}`).expect(200);
    clock.current = later(days(30));
    await session(`Bearer ${token}`).expect(404);
  });

  it('ends every session and deletes every unused link on revoke', async () => {
    const first = await sessionFrom(await sessions.link());
    const second = await sessionFrom(await sessions.link());
    const unused = await sessions.link();

    expect(await sessions.revokeAll()).toEqual({ sessions: 2, links: 1 });
    await session(`Bearer ${first}`).expect(404);
    await session(`Bearer ${second}`).expect(404);
    await signIn(unused).expect(404);
  });

  it('allows five sign-ins in ten minutes from one address, then waits without spending the link', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signIn(unknownToken()).expect(404);
    }
    const link = await sessions.link();
    const limited = await signIn(link).expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    await signIn(link, '198.51.100.4').expect(201);
  });

  it('limits the address the proxy added, whatever the caller put before it', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signIn(unknownToken(), `192.0.2.${String(attempt)}, ${address}`).expect(404);
    }
    await signIn(unknownToken(), `192.0.2.99, ${address}`).expect(429);
    await signIn(unknownToken(), address).expect(429);
  });

  it('counts the addresses of one IPv6 /64 as one network and keeps its neighbours apart', async () => {
    for (let host = 1; host <= 5; host += 1) {
      await signIn(unknownToken(), `2001:db8:1:2::${String(host)}`).expect(404);
    }
    await signIn(unknownToken(), '2001:db8:1:2:aaaa:bbbb:cccc:dddd').expect(429);
    await signIn(unknownToken(), '2001:db8:1:3::1').expect(404);
  });

  it('keeps no address in the rate limit keys', async () => {
    await signIn(unknownToken()).expect(404);

    const keys = (await prisma.rateLimit.findMany()).map(({ key }) => key);
    expect(keys).toEqual([expect.stringMatching(/^admin:10m:[0-9a-f]{32}$/)]);
  });

  it('deletes expired links and sessions in the cleanup, and keeps the rest', async () => {
    await sessions.link();
    await sessionFrom(await sessions.link());
    clock.current = later(minutes(20));
    const kept = await sessionFrom(await sessions.link());
    clock.current = later(days(30) - minutes(5));
    const fresh = await sessions.link();

    clock.current = later(days(30));
    await sessions.cleanup();

    expect(await prisma.adminLoginToken.count()).toBe(1);
    expect(await prisma.adminSession.count()).toBe(1);
    await session(`Bearer ${kept}`).expect(200);
    await signIn(fresh).expect(201);
  });
});

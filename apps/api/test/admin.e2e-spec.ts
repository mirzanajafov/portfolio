import type { NestExpressApplication } from '@nestjs/platform-express';
import { adminSessionSchema, adminSignInSchema } from '@portfolio/content/admin';
import {
  applicationListSchema,
  applicationPageSchema,
  applicationViewSchema,
} from '@portfolio/content/applications';
import { reportSchema } from '@portfolio/content/report';
import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminSessionsService } from '../src/admin/admin-sessions.service.js';
import { ApplicationsService } from '../src/applications/applications.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { anApplication } from './applications.js';
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
    await prisma.$executeRaw`TRUNCATE "AdminLoginToken", "AdminSession", "RateLimit", "Application" CASCADE`;
  });

  it('starts a 30-day session from a link once, and then answers that link like an unknown one', async () => {
    const link = await sessions.link();

    const { token, expiresAt } = adminSignInSchema.parse((await signIn(link).expect(201)).body);
    expect(expiresAt).toEqual(later(days(30)));
    expect(adminSessionSchema.parse((await session(`Bearer ${token}`).expect(200)).body)).toEqual({
      expiresAt: later(days(30)),
    });

    const used = await signIn(link).expect(404);
    const unknown = await signIn(unknownToken()).expect(404);
    expect(used.body).toEqual(unknown.body);
  });

  it('starts one session when eight callers spend the same link at once', async () => {
    const link = await sessions.link();

    const answers = await Promise.all(
      Array.from({ length: 8 }, (_, caller) => signIn(link, `198.51.100.${String(caller)}`)),
    );

    const statuses = answers.map(({ status }) => status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 404)).toHaveLength(7);
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

  it('answers the report for the days asked, in the shape the site reads back with its dates', async () => {
    const token = await sessionFrom(await sessions.link());

    const answer = await request(app.getHttpServer())
      .get('/admin/report?days=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const report = reportSchema.parse(answer.body);
    expect(report.period).toMatchObject({ days: 1, to: start });
    expect(report.period.from).toBeInstanceOf(Date);
  });

  it('reports the last 7 days when none are asked for', async () => {
    const token = await sessionFrom(await sessions.link());

    const answer = await request(app.getHttpServer())
      .get('/admin/report')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(reportSchema.parse(answer.body).period.days).toBe(7);
  });

  it.each(['0', '31', '2.5', 'week', '0x1e', '1e1', '%207'])('refuses %s days', async (days) => {
    const token = await sessionFrom(await sessions.link());

    await request(app.getHttpServer())
      .get(`/admin/report?days=${days}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('is a 404 without a session, before it reads the days', async () => {
    await request(app.getHttpServer()).get('/admin/report?days=week').expect(404);
    await request(app.getHttpServer())
      .get('/admin/report?days=7')
      .set('Authorization', `Bearer ${unknownToken()}`)
      .expect(404);
  });

  it('answers a registered application with nothing to undo yet, and a 404 for a code nobody has', async () => {
    const token = await sessionFrom(await sessions.link());
    await prisma.application.create({
      data: { ...anApplication({ appliedOn: start }), code: 'memh' },
    });
    const ask = (code: string) =>
      request(app.getHttpServer())
        .get(`/admin/applications/${code}`)
        .set('Authorization', `Bearer ${token}`);

    const memh = await ask('memh').expect(200);
    await ask('memj').expect(404);

    expect(applicationPageSchema.parse(memh.body)).toMatchObject({ code: 'memh', undoTo: null });
    await ask('Memh!').expect(400);
  });

  it('is a 404 for an application without a session, before it reads the code', async () => {
    await request(app.getHttpServer()).get('/admin/applications/Memh!').expect(404);
  });

  describe('writing applications', () => {
    const acme = {
      company: 'Acme',
      role: 'Backend Engineer',
      appliedOn: '2026-10-01',
      channel: 'direct',
      cvVariant: 'base 2026-10-01',
      code: 'memh',
    };

    const write = (method: 'post' | 'patch', path: string, token: string, body?: object) => {
      const server = request(app.getHttpServer());
      const url = `/admin/applications${path}`;
      const call = method === 'post' ? server.post(url) : server.patch(url);
      return call.set('Authorization', `Bearer ${token}`).send(body);
    };

    const signedInWithAcme = async () => {
      const token = await sessionFrom(await sessions.link());
      await write('post', '', token, acme).expect(201);
      return token;
    };

    const openConnections = (count: number) =>
      Promise.all(Array.from({ length: count }, () => prisma.$executeRaw`SELECT pg_sleep(0.05)`));

    const history = async () =>
      (await prisma.applicationChange.findMany({ orderBy: { id: 'asc' } })).map(
        ({ field, before, after }) => [field, before, after],
      );

    it('adds an application with its channel and variant, and answers it the way /admin reads it', async () => {
      const token = await sessionFrom(await sessions.link());

      const added = await write('post', '', token, acme).expect(201);

      expect(added.body).toEqual({
        ...acme,
        status: 'sent',
        answeredOn: null,
        notes: '',
        firstSeenOn: null,
        country: null,
        city: null,
        atsHost: null,
        networks: [],
        version: 0,
      });
    });

    it('keeps only the fields that differ when an edit sends them all', async () => {
      const token = await signedInWithAcme();

      await write('patch', '/memh', token, {
        company: 'Acme',
        role: 'Backend Engineer',
        appliedOn: '2026-10-01',
        channel: 'direct',
        cvVariant: 'base 2026-10-01',
        status: 'sent',
        notes: 'Applied through the form.',
        country: null,
        city: null,
        atsHost: null,
        networks: [],
      }).expect(200);

      expect(await history()).toEqual([['notes', '', 'Applied through the form.']]);
    });

    it('keeps only the lowercase host of an ATS link pasted whole', async () => {
      const token = await sessionFrom(await sessions.link());

      const added = await write('post', '', token, {
        ...acme,
        atsHost: 'https://Boards.Greenhouse.io/acme/jobs/1',
      }).expect(201);

      expect(added.body).toMatchObject({ atsHost: 'boards.greenhouse.io' });
    });

    it('lists the applications newest first, in the shape /admin reads', async () => {
      const token = await signedInWithAcme();
      await write('post', '', token, {
        ...acme,
        code: 'kxqtz',
        company: 'Wolt',
        appliedOn: '2026-10-02',
      }).expect(201);

      const listed = await request(app.getHttpServer())
        .get('/admin/applications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const companies = applicationListSchema.parse(listed.body).map(({ company }) => company);
      expect(companies).toEqual(['Wolt', 'Acme']);
    });

    it('says which status an undo would restore', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'screening' }).expect(200);

      const page = await request(app.getHttpServer())
        .get('/admin/applications/memh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(page.body).toMatchObject({ status: 'screening', undoTo: 'sent' });
    });

    it('corrects the day I applied and the hints, clears a hint with null, and keeps each change in the history', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { country: 'AZ', city: 'Baku' }).expect(200);

      const edited = await write('patch', '/memh', token, {
        appliedOn: '2026-09-30',
        city: null,
        atsHost: 'jobs.lever.co',
        networks: ['ACME-NET'],
      }).expect(200);

      expect(edited.body).toMatchObject({
        appliedOn: '2026-09-30',
        country: 'AZ',
        city: null,
        atsHost: 'jobs.lever.co',
        networks: ['ACME-NET'],
      });
      expect(await history()).toEqual([
        ['country', null, 'AZ'],
        ['city', null, 'Baku'],
        ['appliedOn', '2026-10-01', '2026-09-30'],
        ['city', 'Baku', null],
        ['atsHost', null, 'jobs.lever.co'],
        ['networks', '[]', '["ACME-NET"]'],
      ]);
    });

    it('refuses an applied day after today in Baku, after the answer, or after the first visit', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'screening' }).expect(200);
      await prisma.application.update({
        where: { code: 'memh' },
        data: { firstSeenOn: new Date('2026-10-01') },
      });

      const future = await write('patch', '/memh', token, { appliedOn: '2026-10-03' }).expect(400);
      const afterAnswer = await write('patch', '/memh', token, {
        appliedOn: '2026-10-02',
        answeredOn: '2026-10-01',
      }).expect(400);
      const afterVisit = await write('patch', '/memh', token, { appliedOn: '2026-10-02' }).expect(
        400,
      );

      expect(future.body).toMatchObject({ message: 'appliedOn 2026-10-03 is after today in Baku' });
      expect(afterAnswer.body).toMatchObject({
        message: 'appliedOn 2026-10-02 is after answeredOn 2026-10-01',
      });
      expect(afterVisit.body).toMatchObject({
        message: 'appliedOn 2026-10-02 is after the first visit on 2026-10-01',
      });
    });

    it('takes a country in either case, and refuses a hint it would refuse on registration', async () => {
      const token = await signedInWithAcme();

      const edited = await write('patch', '/memh', token, { country: ' az ' }).expect(200);
      expect(edited.body).toMatchObject({ country: 'AZ' });

      await write('patch', '/memh', token, { country: 'AZE' }).expect(400);
      await write('patch', '/memh', token, { country: 'ıe' }).expect(400);
      await write('patch', '/memh', token, { atsHost: 'my ats' }).expect(400);
      await write('patch', '/memh', token, { networks: [''] }).expect(400);
    });

    it('refuses an application with a channel the CSV has no name for, a field it does not know, a day after today in Baku, or a taken code', async () => {
      const token = await signedInWithAcme();

      await write('post', '', token, { ...acme, code: 'kxqtz', channel: 'friend' }).expect(400);
      await write('post', '', token, { ...acme, code: 'kxqtz', salary: 1 }).expect(400);
      await write('post', '', token, { ...acme, code: 'kxqtz', appliedOn: '2026-10-03' }).expect(
        400,
      );
      await write('post', '', token, acme).expect(409);
    });

    it('is a 404 for every write without a session, before it reads the body', async () => {
      await request(app.getHttpServer()).post('/admin/applications').send({}).expect(404);
      await request(app.getHttpServer()).patch('/admin/applications/memh').send({}).expect(404);
      await request(app.getHttpServer()).post('/admin/applications/memh/undo').expect(404);
    });

    it('moves a status forward, notes the Baku day of the first answer, and keeps each changed field in the history', async () => {
      const token = await signedInWithAcme();
      clock.current = new Date('2026-10-04T21:30:00Z');

      const moved = await write('patch', '/memh', token, { status: 'screening' }).expect(200);

      expect(moved.body).toMatchObject({ status: 'screening', answeredOn: '2026-10-05' });
      expect(await history()).toEqual([
        ['status', 'sent', 'screening'],
        ['answeredOn', null, '2026-10-05'],
      ]);
    });

    it('refuses a status that would go back or past an end, and says which ones it can take', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'interview' }).expect(200);

      const refused = await write('patch', '/memh', token, { status: 'screening' }).expect(409);

      expect(refused.body).toMatchObject({
        message: "an application that is interview can't become screening",
        allowed: ['offer', 'rejected', 'withdrawn'],
      });
      expect(await prisma.application.findUnique({ where: { code: 'memh' } })).toMatchObject({
        status: 'interview',
      });
      await write('patch', '/memh', token, { status: 'rejected' }).expect(200);
      const ended = await write('patch', '/memh', token, { status: 'offer' }).expect(409);
      expect(ended.body).toMatchObject({ allowed: [] });
    });

    it('makes a move once when eight edits ask for it at the same time', async () => {
      await signedInWithAcme();
      const applications = app.get(ApplicationsService);
      await openConnections(8);

      await Promise.all(
        Array.from({ length: 8 }, () => applications.edit('memh', { status: 'rejected' })),
      );

      expect(await history()).toEqual([
        ['status', 'sent', 'rejected'],
        ['answeredOn', null, '2026-10-02'],
      ]);
    });

    it('takes a day as today once it has started in Baku, four hours before UTC', async () => {
      const token = await signedInWithAcme();
      clock.current = new Date('2026-10-02T21:00:00Z');

      await write('post', '', token, { ...acme, code: 'kxqtz', appliedOn: '2026-10-03' }).expect(
        201,
      );
      await write('post', '', token, { ...acme, code: 'mpw7r', appliedOn: '2026-10-04' }).expect(
        400,
      );
      await write('patch', '/memh', token, {
        status: 'screening',
        answeredOn: '2026-10-03',
      }).expect(200);
    });

    it('undoes the last status change with the answer day it set, and writes the undo to the history', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'rejected' }).expect(200);
      clock.current = later(minutes(5));

      const undone = await write('post', '/memh/undo', token, {}).expect(200);

      expect(undone.body).toMatchObject({ status: 'sent', answeredOn: null });
      expect(await history()).toEqual([
        ['status', 'sent', 'rejected'],
        ['answeredOn', null, '2026-10-02'],
        ['status', 'rejected', 'sent'],
        ['answeredOn', '2026-10-02', null],
      ]);
    });

    it('walks back through each status change, then has nothing left to undo', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'screening' }).expect(200);
      await write('patch', '/memh', token, { status: 'interview' }).expect(200);

      const once = await write('post', '/memh/undo', token, {}).expect(200);
      const twice = await write('post', '/memh/undo', token, {}).expect(200);

      expect(once.body).toMatchObject({ status: 'screening', answeredOn: '2026-10-02' });
      expect(twice.body).toMatchObject({ status: 'sent', answeredOn: null });
      await write('post', '/memh/undo', token, {}).expect(409);
    });

    it('refuses an edit or an undo from a page that loaded an older version, and changes nothing', async () => {
      const token = await signedInWithAcme();
      const loaded = await write('patch', '/memh', token, { status: 'screening' }).expect(200);
      const { version } = applicationViewSchema.parse(loaded.body);
      await write('patch', '/memh', token, { version, notes: 'From the phone.' }).expect(200);

      const edit = await write('patch', '/memh', token, { version, role: 'Lead' }).expect(409);
      const undo = await write('post', '/memh/undo', token, { version }).expect(409);

      expect([edit.body, undo.body]).toMatchObject([
        { message: 'the application changed since that page loaded' },
        { message: 'the application changed since that page loaded' },
      ]);
      expect(await prisma.application.findUnique({ where: { code: 'memh' } })).toMatchObject({
        role: 'Backend Engineer',
        status: 'screening',
        notes: 'From the phone.',
        version: version + 1,
      });
    });

    it('counts a version only for a write that changed something', async () => {
      const token = await signedInWithAcme();

      await write('patch', '/memh', token, { version: 0, notes: '' }).expect(200);
      const changed = await write('patch', '/memh', token, { version: 0, notes: 'x' }).expect(200);

      expect(changed.body).toMatchObject({ notes: 'x', version: 1 });
    });
    it('keeps an answer day I corrected when an undo lands on a status that still has an answer', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { status: 'screening' }).expect(200);
      await write('patch', '/memh', token, { answeredOn: '2026-10-01' }).expect(200);
      await write('patch', '/memh', token, { status: 'interview' }).expect(200);

      const undone = await write('post', '/memh/undo', token, {}).expect(200);

      expect(undone.body).toMatchObject({ status: 'screening', answeredOn: '2026-10-01' });
    });

    it('leaves a sent application unanswered when only its notes change', async () => {
      const token = await signedInWithAcme();

      const edited = await write('patch', '/memh', token, {
        notes: 'Applied through the form.',
      }).expect(200);

      expect(edited.body).toMatchObject({ status: 'sent', answeredOn: null });
    });

    it('refuses an answer day for an application nobody answered', async () => {
      const token = await signedInWithAcme();

      const sent = await write('patch', '/memh', token, { answeredOn: '2026-10-02' }).expect(400);
      await write('patch', '/memh', token, { status: 'withdrawn' }).expect(200);
      await write('patch', '/memh', token, { answeredOn: '2026-10-02' }).expect(400);

      expect(sent.body).toMatchObject({
        message: 'answeredOn 2026-10-02 needs an answer, and none came',
      });
      expect(await history()).toEqual([['status', 'sent', 'withdrawn']]);
    });

    it('refuses an answer day before the day I applied or after today in Baku', async () => {
      const token = await signedInWithAcme();

      const early = await write('patch', '/memh', token, {
        status: 'screening',
        answeredOn: '2026-09-30',
      }).expect(400);
      const late = await write('patch', '/memh', token, {
        status: 'screening',
        answeredOn: '2026-10-03',
      }).expect(400);

      expect(early.body).toMatchObject({
        message: 'answeredOn 2026-09-30 is before appliedOn 2026-10-01',
      });
      expect(late.body).toMatchObject({ message: 'answeredOn 2026-10-03 is after today in Baku' });
      expect(await history()).toEqual([]);
    });

    it('says there is nothing to undo before the first status change', async () => {
      const token = await signedInWithAcme();
      await write('patch', '/memh', token, { notes: 'Applied through the form.' }).expect(200);

      await write('post', '/memh/undo', token, {}).expect(409);
    });

    it('is a 404 for a code nobody registered, and a 400 for an empty edit or a field it does not know', async () => {
      const token = await signedInWithAcme();

      await write('patch', '/kxqtz', token, { notes: 'x' }).expect(404);
      await write('patch', '/memh', token, {}).expect(400);
      await write('patch', '/memh', token, { notes: 'x', salary: 1 }).expect(400);
    });

    it('takes 60 changes in ten minutes from one session, then says when to come back', async () => {
      const token = await signedInWithAcme();
      for (let change = 2; change <= 60; change += 1) {
        await write('patch', '/memh', token, { notes: String(change) }).expect(200);
      }

      const refused = await write('patch', '/memh', token, { notes: 'one too many' }).expect(429);

      expect(refused.headers['retry-after']).toBe('600');
      expect(await prisma.application.findUnique({ where: { code: 'memh' } })).toMatchObject({
        notes: '60',
      });
    });
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

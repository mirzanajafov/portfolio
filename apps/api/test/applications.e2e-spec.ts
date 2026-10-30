import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { refCode } from '@portfolio/content/analytics';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApplicationsService,
  type NewApplication,
} from '../src/applications/applications.service.js';
import { CliModule } from '../src/cli.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const anApplication = (overrides: Partial<NewApplication> = {}): NewApplication => ({
  company: 'Acme',
  role: 'Backend Engineer',
  appliedOn: new Date('2026-10-30'),
  networks: [],
  ...overrides,
});

describe('applications against a real database', () => {
  let app: INestApplicationContext;
  let applications: ApplicationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CliModule] }).compile();
    app = await moduleRef.init();
    applications = app.get(ApplicationsService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "Application"`;
  });

  it('gives a new application a fresh code a link can carry', async () => {
    const application = await applications.add(
      anApplication({ country: 'NL', city: 'Amsterdam', networks: ['ACME-NET'] }),
    );
    expect(application.code).toMatch(refCode);
    expect(application).toMatchObject({
      company: 'Acme',
      country: 'NL',
      city: 'Amsterdam',
      atsHost: null,
      networks: ['ACME-NET'],
    });
  });

  it('registers a code that already went out, as it is', async () => {
    const application = await applications.add(
      anApplication({ company: 'Globex', code: 'kxqt', country: 'AZ', city: 'Baku' }),
    );
    expect(application.code).toBe('kxqt');
  });

  it('refuses a code another application already has', async () => {
    await applications.add(anApplication({ code: 'memh' }));
    await expect(
      applications.add(anApplication({ company: 'Other', code: 'memh' })),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('lists the newest application first', async () => {
    await applications.add(
      anApplication({ company: 'Earlier', appliedOn: new Date('2026-10-01') }),
    );
    await applications.add(anApplication({ company: 'Later', appliedOn: new Date('2026-10-30') }));
    expect((await applications.list()).map(({ company }) => company)).toEqual(['Later', 'Earlier']);
  });
});

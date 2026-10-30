import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { refCode } from '@portfolio/content/analytics';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationsService,
  type NewApplication,
} from '../src/applications/applications.service.js';
import { newCode } from '../src/applications/code.js';
import { CliModule } from '../src/cli/cli.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

vi.mock(import('../src/applications/code.js'), async (importOriginal) => {
  const original = await importOriginal();
  return { newCode: vi.fn(original.newCode) };
});

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
    vi.mocked(newCode).mockReset();
    await prisma.$executeRaw`TRUNCATE "Application" CASCADE`;
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
    ).rejects.toThrow('code memh already belongs to another application');
  });

  it('draws another code when the one it drew is taken', async () => {
    await applications.add(anApplication({ code: 'kxqtz' }));
    vi.mocked(newCode).mockReturnValueOnce('kxqtz').mockReturnValueOnce('mpw7r');
    expect((await applications.add(anApplication({ company: 'Other' }))).code).toBe('mpw7r');
  });

  it('gives up after five codes that are all taken', async () => {
    await applications.add(anApplication({ code: 'kxqtz' }));
    vi.mocked(newCode).mockReturnValue('kxqtz');
    await expect(applications.add(anApplication({ company: 'Other' }))).rejects.toThrow(
      'code kxqtz already belongs to another application',
    );
    expect(newCode).toHaveBeenCalledTimes(5);
  });

  it('finds an application by its code, and none for a code nobody has', async () => {
    await applications.add(anApplication({ code: 'memh' }));
    expect(await applications.find('memh')).toMatchObject({ company: 'Acme' });
    expect(await applications.find('memj')).toBeNull();
  });

  it('lists the newest application first', async () => {
    await applications.add(
      anApplication({ company: 'Earlier', appliedOn: new Date('2026-10-01') }),
    );
    await applications.add(anApplication({ company: 'Later', appliedOn: new Date('2026-10-30') }));
    expect((await applications.list()).map(({ company }) => company)).toEqual(['Later', 'Earlier']);
  });
});

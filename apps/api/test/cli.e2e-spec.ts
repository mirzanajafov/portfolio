import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ApplicationsService } from '../src/applications/applications.service.js';
import { CliModule } from '../src/cli/cli.module.js';
import { runCli } from '../src/cli/run.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

vi.mock(import('../src/applications/code.js'), () => ({ newCode: () => 'k7mpx' }));

type SiteAnswer = (request: IncomingMessage, response: ServerResponse) => void;

const token = 'c'.repeat(64);
const addAcme = [
  'application',
  'add',
  '--company',
  'Acme',
  '--role',
  'Backend Engineer',
  '--applied',
  '2026-10-30',
];
const stdoutIsTTY = process.stdout.isTTY;

const drawCv: SiteAnswer = (request, response) => {
  if (request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/pdf' }).end(`%PDF ${request.url ?? ''}`);
};

describe('the application commands', () => {
  let context: INestApplicationContext;
  let applications: ApplicationsService;
  let prisma: PrismaService;
  let site: Server;
  let siteAddress: string;
  let answer: SiteAnswer;
  let asked: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CliModule] }).compile();
    context = await moduleRef.init();
    applications = context.get(ApplicationsService);
    prisma = context.get(PrismaService);
    site = createServer((request, response) => {
      asked.push(request.url ?? '');
      answer(request, response);
    });
    await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve));
    const address = site.address();
    assert(address !== null && typeof address === 'object');
    siteAddress = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    site.closeAllConnections();
    await new Promise((resolve) => site.close(resolve));
    await context.close();
  });

  beforeEach(async () => {
    answer = drawCv;
    asked = [];
    process.stdout.isTTY = false;
    vi.stubEnv('CV_RENDER_TOKEN', token);
    vi.stubEnv('WEB_URL', siteAddress);
    await prisma.$executeRaw`TRUNCATE "Application"`;
  });

  afterEach(() => {
    process.stdout.isTTY = stdoutIsTTY;
    vi.unstubAllEnvs();
  });

  async function cli(...args: string[]) {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const out = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        stdout.push(Buffer.from(chunk));
        return true;
      });
    const err = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(Buffer.from(chunk));
        return true;
      });
    try {
      const status = await runCli(args);
      return {
        status,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      };
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  }

  async function registeredCodes(): Promise<string[]> {
    return (await applications.list()).map(({ code }) => code);
  }

  function registerMemh() {
    return applications.add({
      company: 'Acme',
      role: 'Backend Engineer',
      appliedOn: new Date('2026-10-30'),
      code: 'memh',
      networks: [],
    });
  }

  it('registers an application, prints its code and link, and writes the CV the site drew for that code', async () => {
    expect(await cli(...addAcme)).toEqual({
      status: 0,
      stdout: '%PDF /internal/cv/k7mpx',
      stderr: 'Acme: k7mpx, https://najafov.dev/?r=k7mpx\n',
    });
    expect(await registeredCodes()).toEqual(['k7mpx']);
  });

  it('writes the CV again for a registered code', async () => {
    await registerMemh();
    expect(await cli('application', 'cv', 'memh')).toEqual({
      status: 0,
      stdout: '%PDF /internal/cv/memh',
      stderr: '',
    });
  });

  it('prints the report for the days asked, even to a terminal', async () => {
    process.stdout.isTTY = true;
    const { status, stdout } = await cli('report', '--days', '1');
    expect(status).toBe(0);
    expect(stdout).toMatch(/^Visits in the last 1 day, /);
    expect(stdout).toContain('Sources: none');
  });

  it('lists the applications with their codes', async () => {
    await registerMemh();
    expect((await cli('application', 'list')).stdout).toBe(
      '2026-10-30  memh  Acme, Backend Engineer\n',
    );
  });

  it('refuses the CV of a code nobody registered, without asking the site', async () => {
    expect(await cli('application', 'cv', 'memj')).toEqual({
      status: 1,
      stdout: '',
      stderr: 'no application has code memj\n',
    });
    expect(asked).toEqual([]);
  });

  it('says a taken code is taken', async () => {
    await registerMemh();
    expect(await cli(...addAcme, '--code', 'memh')).toEqual({
      status: 1,
      stdout: '',
      stderr: 'code memh already belongs to another application\n',
    });
  });

  it('registers nothing when the token is missing', async () => {
    vi.stubEnv('CV_RENDER_TOKEN', undefined);
    expect((await cli(...addAcme)).status).toBe(1);
    expect(await registeredCodes()).toEqual([]);
  });

  it('registers nothing when stdout is a terminal', async () => {
    process.stdout.isTTY = true;
    expect((await cli(...addAcme)).status).toBe(1);
    expect(await registeredCodes()).toEqual([]);
  });

  it('keeps the application and says how to get its CV when the site fails', async () => {
    answer = (_, response) => response.writeHead(502).end();
    expect(await cli(...addAcme)).toEqual({
      status: 1,
      stdout: '',
      stderr: [
        'Acme: k7mpx, https://najafov.dev/?r=k7mpx',
        'the site answered 502 for the CV of k7mpx',
        'k7mpx is registered, so application cv k7mpx writes its CV once the site answers',
        '',
      ].join('\n'),
    });
    expect(await registeredCodes()).toEqual(['k7mpx']);
  });

  it('says what failed when the site fails for a registered code', async () => {
    await registerMemh();
    answer = (_, response) => response.writeHead(502).end();
    expect(await cli('application', 'cv', 'memh')).toEqual({
      status: 1,
      stdout: '',
      stderr: 'the site answered 502 for the CV of memh\n',
    });
  });

  it('reads the arguments before it touches the database or its settings', async () => {
    vi.stubEnv('CLIENT_HASH_SECRET', 'short');
    const { status, stderr } = await cli('application', 'remove', 'memh');
    expect(status).toBe(2);
    expect(stderr).toContain('there is no command "application remove memh"');
  });
});

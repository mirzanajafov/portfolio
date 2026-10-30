import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { refCode } from '@portfolio/content/analytics';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { fetchApplicationCv } from './applications/application-cv.js';
import { ApplicationsService } from './applications/applications.service.js';
import { CliModule } from './cli.module.js';
import { ENV, type Env } from './config/env.js';

const site = 'https://najafov.dev';

const newApplication = z.strictObject({
  company: z.string().trim().min(1),
  role: z.string().trim().min(1),
  applied: z.iso.date().transform((day) => new Date(day)),
  code: z.string().regex(refCode).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: z.string().trim().min(1).optional(),
  ats: z.string().trim().min(1).optional(),
  network: z.array(z.string().trim().min(1)).default([]),
});

const usage = `usage:
  cli.js application add --company <name> --role <title> --applied <yyyy-mm-dd>
      [--code <code>] [--country <XX>] [--city <name>] [--ats <host>] [--network <name>]...
  cli.js application list
  cli.js application cv <code>`;

async function writeCv(code: string, env: Env): Promise<void> {
  if (process.stdout.isTTY) {
    process.stderr.write(
      'send stdout to a file to save the CV, for example > Mirza-Najafov-CV.pdf\n',
    );
    return;
  }
  if (!env.CV_RENDER_TOKEN) {
    throw new Error('CV_RENDER_TOKEN is not set, so the CV of an application cannot be fetched');
  }
  process.stdout.write(
    await fetchApplicationCv(code, { webUrl: env.WEB_URL, token: env.CV_RENDER_TOKEN }),
  );
}

const [area, command, ...rest] = process.argv.slice(2);
const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
const env = app.get<Env>(ENV);
const applications = app.get(ApplicationsService);
try {
  if (area === 'application' && command === 'add') {
    const { values } = parseArgs({
      args: rest,
      options: {
        company: { type: 'string' },
        role: { type: 'string' },
        applied: { type: 'string' },
        code: { type: 'string' },
        country: { type: 'string' },
        city: { type: 'string' },
        ats: { type: 'string' },
        network: { type: 'string', multiple: true },
      },
    });
    const { applied, ats, network, ...fields } = newApplication.parse(values);
    const application = await applications.add({
      ...fields,
      appliedOn: applied,
      atsHost: ats,
      networks: network,
    });
    process.stderr.write(
      `${application.company}: ${application.code}, ${site}/?r=${application.code}\n`,
    );
    await writeCv(application.code, env);
  } else if (area === 'application' && command === 'list') {
    for (const { appliedOn, company, role, code } of await applications.list()) {
      process.stdout.write(
        `${appliedOn.toISOString().slice(0, 10)}  ${code}  ${company}, ${role}\n`,
      );
    }
  } else if (area === 'application' && command === 'cv' && rest[0] && refCode.test(rest[0])) {
    await writeCv(rest[0], env);
  } else {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
  }
} finally {
  await app.close();
}

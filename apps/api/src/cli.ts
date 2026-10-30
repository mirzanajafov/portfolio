import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { siteUrl } from '@portfolio/content';
import { fetchApplicationCv } from './applications/application-cv.js';
import { ApplicationsService, CodeTakenError } from './applications/applications.service.js';
import { parseCommand, usage, type Command } from './cli-command.js';
import { CliModule } from './cli.module.js';
import { ENV, type Env } from './config/env.js';

async function run(command: Command, applications: ApplicationsService, env: Env): Promise<number> {
  if (command.name === 'application list') {
    for (const { appliedOn, company, role, code } of await applications.list()) {
      process.stdout.write(
        `${appliedOn.toISOString().slice(0, 10)}  ${code}  ${company}, ${role}\n`,
      );
    }
    return 0;
  }
  if (!env.CV_RENDER_TOKEN) {
    process.stderr.write(
      'CV_RENDER_TOKEN is not set, so the CV of an application cannot be fetched\n',
    );
    return 1;
  }
  const site = { webUrl: env.WEB_URL, token: env.CV_RENDER_TOKEN };
  if (command.name === 'application cv') {
    if (!(await applications.find(command.code))) {
      process.stderr.write(`no application has code ${command.code}\n`);
      return 1;
    }
    process.stdout.write(await fetchApplicationCv(command.code, site));
    return 0;
  }
  const { company, code } = await applications.add(command.application);
  process.stderr.write(`${company}: ${code}, ${siteUrl}/?r=${code}\n`);
  try {
    process.stdout.write(await fetchApplicationCv(code, site));
  } catch (error) {
    throw new Error(
      `${company} is registered as ${code} but its CV could not be fetched, so run application cv ${code} to try again`,
      { cause: error },
    );
  }
  return 0;
}

async function main(args: readonly string[]): Promise<number> {
  let command: Command;
  try {
    command = parseCommand(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}\n`);
    return 2;
  }
  if (command.name !== 'application list' && process.stdout.isTTY) {
    process.stderr.write('stdout is a terminal, so send it to a file to save the CV\n');
    return 1;
  }
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'fatal'] });
  try {
    return await run(command, app.get(ApplicationsService), app.get<Env>(ENV));
  } catch (error) {
    if (error instanceof CodeTakenError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  } finally {
    await app.close();
  }
}

process.exitCode = await main(process.argv.slice(2));

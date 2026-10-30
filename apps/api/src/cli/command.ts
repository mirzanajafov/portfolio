import { analyticsDays, hostName, refCode } from '@portfolio/content/analytics';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { reportDays } from '../analytics/report/analytics-report.service.js';
import type { NewApplication } from '../applications/applications.service.js';

export type Command =
  | { name: 'report'; days: number; all: boolean }
  | { name: 'application add'; application: NewApplication }
  | { name: 'application list' }
  | { name: 'application cv'; code: string }
  | { name: 'admin link' }
  | { name: 'admin revoke' };

export const usage = `usage:
  cli.js report [--days <1-${String(analyticsDays)}>] [--all]
  cli.js application add --company <name> --role <title> --applied <yyyy-mm-dd>
      [--code <code>] [--country <XX>] [--city <name>] [--ats <host>] [--network <name>]...
  cli.js application list
  cli.js application cv <code>
  cli.js admin link
  cli.js admin revoke`;

const reportOptions = {
  days: { type: 'string' },
  all: { type: 'boolean', default: false },
} as const;

const reportRequest = z.strictObject({
  days: reportDays,
  all: z.boolean(),
});

const addOptions = {
  company: { type: 'string' },
  role: { type: 'string' },
  applied: { type: 'string' },
  code: { type: 'string' },
  country: { type: 'string' },
  city: { type: 'string' },
  ats: { type: 'string' },
  network: { type: 'string', multiple: true },
} as const;

const newApplication = z
  .strictObject({
    company: z.string().trim().min(1),
    role: z.string().trim().min(1),
    applied: z.iso.date().transform((day) => new Date(day)),
    code: z.string().regex(refCode).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    city: z.string().trim().min(1).optional(),
    ats: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, ''))
      .pipe(z.string().regex(hostName))
      .optional(),
    network: z.array(z.string().trim().min(1)).default([]),
  })
  .transform(({ applied, ats, network, ...fields }): NewApplication => ({
    ...fields,
    appliedOn: applied,
    atsHost: ats,
    networks: network,
  }));

function valid<T>(schema: z.ZodType<T>, values: unknown): T {
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }
  return parsed.data;
}

export function parseCommand(args: readonly string[]): Command {
  const [area, name, ...rest] = args;
  if (area === 'report') {
    const { values } = parseArgs({ args: args.slice(1), options: reportOptions });
    return { name: 'report', ...valid(reportRequest, values) };
  }
  if (area === 'application' && name === 'add') {
    const { values } = parseArgs({ args: rest, options: addOptions });
    return { name: 'application add', application: valid(newApplication, values) };
  }
  if (area === 'application' && name === 'list') {
    if (rest.length > 0) {
      throw new Error('application list takes no arguments');
    }
    return { name: 'application list' };
  }
  if (area === 'application' && name === 'cv') {
    const [code, ...extra] = rest;
    if (code === undefined || extra.length > 0 || !refCode.test(code)) {
      throw new Error('application cv takes one code that a link can carry');
    }
    return { name: 'application cv', code };
  }
  if (area === 'admin' && (name === 'link' || name === 'revoke')) {
    if (rest.length > 0) {
      throw new Error(`admin ${name} takes no arguments`);
    }
    return { name: `admin ${name}` };
  }
  throw new Error(`there is no command "${args.join(' ')}"`);
}

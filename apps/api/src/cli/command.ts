import { analyticsDays, refCode } from '@portfolio/content/analytics';
import { channels } from '@portfolio/content/applications';
import { reportDaysSchema } from '@portfolio/content/report';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { newApplicationSchema, type NewApplication } from '../applications/application.schema.js';

export type Command =
  | { name: 'report'; days: number; all: boolean }
  | { name: 'application add'; application: NewApplication }
  | { name: 'application list' }
  | { name: 'application export' }
  | { name: 'application cv'; code: string }
  | { name: 'admin link' }
  | { name: 'admin revoke' };

export const usage = `usage:
  cli.js report [--days <1-${String(analyticsDays)}>] [--all]
  cli.js application add --company <name> --role <title> --applied <yyyy-mm-dd>
      --channel <${channels.join('|')}> --variant <cv build>
      [--code <code>] [--country <XX>] [--city <name>] [--ats <host>] [--network <name>]...
  cli.js application list
  cli.js application export
  cli.js application cv <code>
  cli.js admin link
  cli.js admin revoke`;

const reportOptions = {
  days: { type: 'string' },
  all: { type: 'boolean', default: false },
} as const;

const reportRequest = z.strictObject({
  days: reportDaysSchema,
  all: z.boolean(),
});

const addOptions = {
  company: { type: 'string' },
  role: { type: 'string' },
  applied: { type: 'string' },
  channel: { type: 'string' },
  variant: { type: 'string' },
  code: { type: 'string' },
  country: { type: 'string' },
  city: { type: 'string' },
  ats: { type: 'string' },
  network: { type: 'string', multiple: true },
} as const;

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
    const {
      values: { applied, variant, ats, network, ...flags },
    } = parseArgs({ args: rest, options: addOptions });
    const application = {
      ...flags,
      appliedOn: applied,
      cvVariant: variant,
      atsHost: ats,
      networks: network,
    };
    return { name: 'application add', application: valid(newApplicationSchema, application) };
  }
  if (area === 'application' && (name === 'list' || name === 'export')) {
    if (rest.length > 0) {
      throw new Error(`application ${name} takes no arguments`);
    }
    return { name: `application ${name}` };
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

import { analyticsDays, refCode } from '@portfolio/content/analytics';
import { reportDaysSchema } from '@portfolio/content/report';
import { parseArgs } from 'node:util';
import { z } from 'zod';

export type Command =
  | { name: 'report'; days: number; all: boolean }
  | { name: 'application list' }
  | { name: 'application export' }
  | { name: 'application cv'; code: string }
  | { name: 'admin link' }
  | { name: 'admin revoke' };

export const usage = `usage:
  cli.js report [--days <1-${String(analyticsDays)}>] [--all]
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

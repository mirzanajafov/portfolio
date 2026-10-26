import { readFileSync } from 'node:fs';
import { z } from 'zod';

function checked<T>(schema: z.ZodType<T>, json: string, source: string): T {
  const result = schema.safeParse(JSON.parse(json));
  if (!result.success) {
    throw new Error(`${source} is not what the scene expects:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function readJson<T>(path: string, schema: z.ZodType<T>): T {
  return checked(schema, readFileSync(path, 'utf8'), path);
}

export function readJsonLines<T>(path: string, schema: z.ZodType<T>): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, index) => (line ? [checked(schema, line, `${path}:${index + 1}`)] : []));
}

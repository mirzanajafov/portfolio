import { readFileSync } from 'node:fs';
import { z } from 'zod';

function parsedJson(source: string, json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`${source} is not JSON`, { cause: error });
  }
}

function checked<T>(source: string, json: string, schema: z.ZodType<T>): T {
  const result = schema.safeParse(parsedJson(source, json));
  if (!result.success) {
    throw new Error(`${source} is not what the scene expects:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function readJson<T>(path: string, schema: z.ZodType<T>): T {
  return checked(path, readFileSync(path, 'utf8'), schema);
}

export function readJsonLines<T>(path: string, schema: z.ZodType<T>): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, index) => (line ? [checked(`${path}:${index + 1}`, line, schema)] : []));
}

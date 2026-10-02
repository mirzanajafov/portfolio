import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import { contentSchema, profileSchema, type Content } from './schema.ts';

export type ContentIssue = {
  file: string;
  path: string;
  message: string;
};

export class ContentError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(issues.map((issue) => `${issue.file} ${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'ContentError';
    this.issues = issues;
  }
}

type Read = { ok: true; value: unknown } | { ok: false };

async function readYaml(root: string, file: string, issues: ContentIssue[]): Promise<Read> {
  let text: string;
  try {
    text = await readFile(join(root, file), 'utf8');
  } catch {
    issues.push({ file, path: '', message: 'file is missing' });
    return { ok: false };
  }
  try {
    return { ok: true, value: parse(text) };
  } catch (error) {
    issues.push({ file, path: '', message: `not valid YAML: ${(error as Error).message}` });
    return { ok: false };
  }
}

function check<T>(
  schema: z.ZodType<T>,
  read: Read,
  file: string,
  issues: ContentIssue[],
): T | undefined {
  if (!read.ok) {
    return undefined;
  }
  const result = schema.safeParse(read.value);
  if (result.success) {
    return result.data;
  }
  for (const issue of result.error.issues) {
    issues.push({ file, path: issue.path.join('.') || '(root)', message: issue.message });
  }
  return undefined;
}

export async function loadContent(root: string): Promise<Content> {
  const issues: ContentIssue[] = [];
  const profile = check(
    profileSchema,
    await readYaml(root, 'profile.yaml', issues),
    'profile.yaml',
    issues,
  );
  if (issues.length > 0 || !profile) {
    throw new ContentError(issues);
  }
  return contentSchema.parse({ profile });
}

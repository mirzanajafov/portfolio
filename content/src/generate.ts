import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Content } from './schema.ts';

export function renderGenerated(content: Content): string {
  return [
    "import type { Content } from '../schema.ts';",
    '',
    `export const content: Content = ${JSON.stringify(content, null, 2)};`,
    '',
  ].join('\n');
}

export async function writeGenerated(content: Content, srcDir: string): Promise<string> {
  const dir = join(srcDir, '.generated');
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'data.ts');
  await writeFile(file, renderGenerated(content), 'utf8');
  return file;
}

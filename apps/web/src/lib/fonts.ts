import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Weight = 400 | 600 | 800;

const directory = join(process.cwd(), 'src', 'assets', 'fonts');

export function fontPath(weight: Weight): string {
  return join(directory, `SchibstedGrotesk-${weight}.ttf`);
}

export async function loadFont(weight: Weight): Promise<Buffer> {
  return readFile(fontPath(weight));
}

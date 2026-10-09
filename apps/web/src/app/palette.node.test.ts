import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, value]) => [
      name,
      value,
    ]),
  );
}

function block(after: string): string {
  const start = css.indexOf(after);
  const open = css.indexOf(':root {', start);
  return css.slice(open, css.indexOf('}', open));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const themes = {
  dark: tokens(block('@theme')),
  light: tokens(block('prefers-color-scheme: light')),
};

describe('palette', () => {
  it.each(Object.entries(themes))(
    'keeps every text colour at AA contrast on the %s background and surfaces',
    (_, theme) => {
      for (const text of ['fg', 'soft', 'muted', 'accent', 'signal']) {
        for (const ground of ['bg', 'surface']) {
          expect(theme[text], text).toBeDefined();
          expect(contrast(theme[text]!, theme[ground]!), `${text} on ${ground}`).toBeGreaterThan(
            4.5,
          );
        }
      }
    },
  );
});

import { readFileSync } from 'node:fs';
import { assert, describe, expect, it } from 'vitest';
import { palette } from '@/lib/palette';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map(
      ([, name = '', value = '']): [string, string] => [name, value],
    ),
  );
}

function block(after: string): string {
  const start = css.indexOf(after);
  const open = css.indexOf(':root {', start);
  return css.slice(open, css.indexOf('}', open));
}

function linear(hex: string, at: number): number {
  const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * linear(hex, 1) + 0.7152 * linear(hex, 3) + 0.0722 * linear(hex, 5);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
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
          const [color, background] = [theme[text], theme[ground]];
          assert(color && background, `${text} or ${ground} is missing`);
          expect(contrast(color, background), `${text} on ${ground}`).toBeGreaterThan(4.5);
        }
      }
    },
  );

  it.each(['dark', 'light'] as const)(
    'gives the OG cards, the CV PDF and the theme colour the same %s colours as the page',
    (theme) => {
      expect(themes[theme]).toMatchObject(palette[theme]);
    },
  );
});

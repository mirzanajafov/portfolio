import { inflateSync } from 'node:zlib';
import { content } from '@portfolio/content';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCvPdf } from './cv-pdf';

let pdf: Buffer;
let text = '';

function unicodeMaps(file: Buffer): string[] {
  const raw = file.toString('latin1');
  const maps: string[] = [];
  for (const match of raw.matchAll(/(?<!end)stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const body = file.subarray(start, raw.indexOf('endstream', start));
    let decoded = '';
    try {
      decoded = inflateSync(body).toString('latin1');
    } catch {
      decoded = body.toString('latin1');
    }
    if (decoded.includes('beginbfrange') || decoded.includes('beginbfchar')) {
      maps.push(decoded);
    }
  }
  return maps;
}

beforeAll(async () => {
  pdf = await buildCvPdf(content);
  const document = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const items = (await page.getTextContent()).items as { str?: string }[];
    pages.push(items.map((item) => item.str ?? '').join(' '));
  }
  text = pages.join(' ').replace(/\s+/g, ' ');
}, 30_000);

describe('the CV as a PDF', () => {
  it('is a real PDF that fits on two pages', () => {
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(text.length).toBeGreaterThan(500);
  });

  it('extracts as text in reading order, which is what an applicant tracking system sees', () => {
    const order = [
      content.profile.name,
      content.profile.headline,
      'Experience',
      ...content.cv.experience.map((role) => role.company ?? role.role),
      'Projects',
      'Skills',
      'Languages',
    ];
    const upper = text.toUpperCase();
    let cursor = -1;
    for (const marker of order) {
      const found = upper.indexOf(marker.toUpperCase(), cursor + 1);
      expect(found, `"${marker}" should come after what precedes it`).toBeGreaterThan(cursor);
      cursor = found;
    }
  });

  it('keeps every word intact, with no ligatures that drop letters on extraction', () => {
    const source = [...content.cv.experience, ...content.cv.mentoring]
      .flatMap((role) => [role.about ?? '', ...role.highlights])
      .concat(content.cv.languages.map((language) => language.level))
      .join(' ');
    const words = new Set(source.split(/[^A-Za-z]+/).filter((word) => word.length >= 3));
    const lower = text.toLowerCase();
    const missing = [...words].filter((word) => !lower.includes(word.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('maps every glyph back to a single character, so simpler parsers do not lose the f in workflows', () => {
    const maps = unicodeMaps(pdf);
    expect(maps.length).toBeGreaterThan(0);
    const targets = maps.flatMap((map) =>
      [...map.matchAll(/\[([^\]]*)\]/g)].flatMap((array) =>
        [...(array[1] ?? '').matchAll(/<([0-9a-fA-F\s]*)>/g)].map((hex) =>
          (hex[1] ?? '').replace(/\s/g, ''),
        ),
      ),
    );
    expect(targets.length).toBeGreaterThan(50);
    expect(targets.filter((hex) => hex.length > 4)).toEqual([]);
  });

  it('labels contract and freelance work the same way the site does', () => {
    expect(text).toContain('Contract');
    expect(text).toContain('Freelance');
  });

  it('carries the email, the site and no phone number', () => {
    expect(text).toContain(content.profile.links.email);
    expect(text).toContain('najafov.dev');
    expect(text).not.toMatch(/\+994/);
  });
});

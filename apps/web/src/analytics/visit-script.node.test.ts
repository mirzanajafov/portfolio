import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const web = new URL('../../', import.meta.url);

describe('visit.js, as the demos load it', () => {
  it('builds into one classic script with nothing to import, under 2 KB gzipped', () => {
    execFileSync(process.execPath, ['scripts/build-visit.ts'], { cwd: web });
    const script = readFileSync(new URL('public/visit.js', web), 'utf8');
    expect(script.startsWith('"use strict";(()=>{')).toBe(true);
    expect(script).not.toMatch(/\bimport\s*[({"'`]|\bexport\s*[{*]/);
    expect(gzipSync(script).length).toBeLessThan(2048);
  });
});

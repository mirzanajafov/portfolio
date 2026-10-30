import { refCode } from '@portfolio/content/analytics';
import { describe, expect, it } from 'vitest';
import { newCode } from './code.js';

describe('newCode', () => {
  it('makes five characters a link can carry, without letters and digits that look alike', () => {
    const codes = Array.from({ length: 2_000 }, newCode);
    for (const code of codes) {
      expect(code).toMatch(refCode);
      expect(code).toMatch(/^[^ilo01]{5}$/);
    }
    expect(new Set(codes).size).toBeGreaterThan(1_990);
  });
});

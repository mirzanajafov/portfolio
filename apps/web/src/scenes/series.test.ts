import { describe, expect, it } from 'vitest';
import { commonLength, sampleAt } from './series';

describe('commonLength', () => {
  it('gives the number of samples every series shares', () => {
    expect(
      commonLength([
        [1, 2],
        [3, 4],
      ]),
    ).toBe(2);
  });

  it('refuses series of different lengths, empty series, and no series at all', () => {
    expect(() => commonLength([[1, 2], [3]])).toThrow(RangeError);
    expect(() => commonLength([[], []])).toThrow(RangeError);
    expect(() => commonLength([])).toThrow(RangeError);
  });
});

describe('sampleAt', () => {
  it('holds the first and last samples past either end', () => {
    expect(sampleAt([1, 2, 3], -4)).toBe(1);
    expect(sampleAt([1, 2, 3], 1.7)).toBe(2);
    expect(sampleAt([1, 2, 3], 9)).toBe(3);
  });
});

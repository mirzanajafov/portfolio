import { describe, expect, it } from 'vitest';
import { pick } from './random';

describe('pick', () => {
  it('picks among the first items it is told to', () => {
    expect(pick(() => 0.99, ['a', 'b', 'c'], 2)).toBe('b');
    expect(pick(() => 0.99, ['a', 'b', 'c'])).toBe('c');
  });

  it('refuses to pick among none, or among more items than there are', () => {
    expect(() => pick(() => 0, ['a'], 0)).toThrow(RangeError);
    expect(() => pick(() => 0, ['a', 'b'], 1.5)).toThrow(RangeError);
    expect(() => pick(() => 0, ['a'], Number.NaN)).toThrow(RangeError);
    expect(() => pick(() => 0, ['a'], 2)).toThrow(RangeError);
    expect(() => pick(() => 0, [])).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import { median, percentile, rankedGroups, tally } from './statistics.js';

describe('percentile', () => {
  it('takes the nearest rank, so every value it gives is one that happened', () => {
    expect(percentile([2600, 1000, 2100, 1800], 0.75)).toBe(2100);
    expect(median([4, 1, 3, 2])).toBe(2);
    expect(median([7])).toBe(7);
  });

  it('has no percentile of nothing', () => {
    expect(median([])).toBeNull();
  });
});

describe('rankedGroups and tally', () => {
  it('put the largest group first, and equal groups in key order', () => {
    const paths = ['/cv', '/', '/projects/a', '/', '/cv', '/'];
    expect(tally(paths, (path) => path)).toEqual([
      ['/', 3],
      ['/cv', 2],
      ['/projects/a', 1],
    ]);
    expect(rankedGroups([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'))).toEqual([
      ['even', [2, 4]],
      ['odd', [1, 3]],
    ]);
  });
});

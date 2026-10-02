import { describe, expect, it } from 'vitest';
import { blurOn, correlationOn, greedyMatch, learningCurve, oracle } from './population';

describe('the learning curve', () => {
  it('passes through the measured points from the Matchium simulator', () => {
    for (const [day, value] of learningCurve) {
      expect(correlationOn(day)).toBeCloseTo(value, 6);
    }
  });

  it('only ever sharpens, and never claims more than the oracle', () => {
    let previous = blurOn(1);
    for (let day = 2; day <= 21; day += 1) {
      expect(blurOn(day)).toBeLessThanOrEqual(previous);
      expect(correlationOn(day)).toBeLessThan(oracle);
      previous = blurOn(day);
    }
  });
});

describe('greedyMatch', () => {
  it('gives nobody more than their daily capacity and pairs the closest first', () => {
    const line = new Float32Array([0, 0, 0, 1, 0, 0, 1.1, 0, 0, 10, 0, 0, 10.2, 0, 0]);
    const pairs = greedyMatch(line, 5, 1);
    expect(pairs).toContainEqual([1, 2]);
    expect(pairs).toContainEqual([3, 4]);
    const load = new Map<number, number>();
    for (const [a, b] of pairs) {
      load.set(a, (load.get(a) ?? 0) + 1);
      load.set(b, (load.get(b) ?? 0) + 1);
    }
    expect(Math.max(...load.values())).toBe(1);
  });
});

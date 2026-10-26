import { describe, expect, it } from 'vitest';
import { createFloor } from './floor-model';
import { seeded } from './random';

describe('the floor model', () => {
  it('runs the estimator Marauder runs, and lands in the error range the benchmark measured', () => {
    const floor = createFloor(seeded(7));
    const errors: number[] = [];
    for (let frame = 0; frame < 60 * 120; frame += 1) {
      floor.step(1 / 60);
      if (frame > 60 * 10 && frame % 30 === 0) {
        errors.push(floor.error());
      }
    }
    const median = errors.sort((a, b) => a - b)[Math.floor(errors.length / 2)];
    expect(errors.length).toBeGreaterThan(200);
    expect(median).toBeGreaterThan(0.3);
    expect(median).toBeLessThan(2.5);
  });

  it('fits a position from the readings once per batch', () => {
    const floor = createFloor(seeded(7));
    const batches = Array.from({ length: 60 }, () => floor.step(1 / 60)).filter(Boolean);
    expect(batches).toHaveLength(floor.flushes());
    expect(floor.flushes()).toBe(6);
  });
});

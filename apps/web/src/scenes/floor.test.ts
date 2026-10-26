import { describe, expect, it } from 'vitest';
import { createFloorScene } from './floor';
import { createFloor, floorParameters } from './floor-model';
import { seeded } from './random';
import { testHooks } from './test-hooks';

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

  it('moves the estimates only when a batch of readings is fitted', () => {
    const floor = createFloor(seeded(7));
    const estimates = () => JSON.stringify(floor.tags.map((tag) => tag.estimate));
    for (let frame = 0; frame < 120; frame += 1) {
      const before = estimates();
      const fitted = floor.step(1 / 60);
      expect(estimates() !== before, `frame ${frame}`).toBe(fitted);
    }
    expect(floor.flushes()).toBe(13);
    expect(floor.tags.every((tag) => tag.fitted)).toBe(true);
  });
});

describe('the floor scene', () => {
  it('labels the receivers and each tag with its error, and counts the fitted batches', () => {
    const { hooks, labels } = testHooks();
    const scene = createFloorScene(hooks);
    for (let frame = 0; frame < 60; frame += 1) {
      scene.step(1 / 60, frame / 60);
    }
    scene.render(1, 1 / 60);
    const texts = labels.map((label) => label.textContent);
    expect(texts.slice(0, 5)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    expect(texts.slice(5)).toHaveLength(floorParameters.tags);
    for (const text of texts.slice(5)) {
      expect(text).toMatch(/^tag [0-9a-f]{4} · ±\d+\.\d m$/);
    }
    const [, batches, error] = scene.readout();
    const fitted = Math.floor(1000 / floorParameters.flushMs);
    expect(batches).toContain(
      `log-distance fit · ${fitted} batches of ${floorParameters.flushMs} ms`,
    );
    expect(error).toMatch(/^estimate error now \d+\.\d{2} m$/);
  });
});

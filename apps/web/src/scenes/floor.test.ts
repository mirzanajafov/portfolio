import { describe, expect, it } from 'vitest';
import { createFloorScene } from './floor';
import { createFloor } from './floor-model';
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
  it('labels the receivers and each tag with its error, counts the batches and reports the mean error', () => {
    const { hooks, labels } = testHooks();
    const scene = createFloorScene(hooks);
    for (let frame = 0; frame < 60; frame += 1) {
      scene.step(1 / 60, frame / 60);
    }
    scene.render(1, 1 / 60);
    const texts = labels.map((label) => label.textContent);
    expect(texts.slice(0, 5)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    const errors = texts.slice(5).map((text) => {
      const match = /^tag [0-9a-f]{4} · ±(\d+\.\d) m$/.exec(text);
      expect(match, text).not.toBeNull();
      return Number(match?.[1]);
    });
    expect(errors).toHaveLength(6);
    const [, batches, error = ''] = scene.readout();
    expect(batches).toContain('log-distance fit · 6 batches of 150 ms');
    expect(error).toMatch(/^estimate error now \d+\.\d{2} m$/);
    const reported = Number(/^estimate error now (\d+\.\d{2}) m$/.exec(error)?.[1]);
    const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    expect(Math.abs(reported - mean)).toBeLessThan(0.055);
  });

  it('writes a tag label before placing it, so the label is kept in frame by its new width', () => {
    const { hooks, labels } = testHooks();
    const placed: string[] = [];
    const scene = createFloorScene({
      ...hooks,
      place: (label) => {
        placed.push(label.textContent);
      },
    });
    scene.render(0, 1 / 60);
    const tags = labels.slice(5).map((label) => label.textContent);
    expect(tags).toHaveLength(6);
    expect(placed.filter((text) => text.startsWith('tag '))).toEqual(tags);
  });
});

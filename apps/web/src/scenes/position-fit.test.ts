import { describe, expect, it } from 'vitest';
import { type Anchor, fitPosition, rssiToDistance } from './position-fit';

const bounds = { minX: -20, minY: -12.5, maxX: 20, maxY: 12.5 };
const receivers: [number, number][] = [
  [-17, -10],
  [17, -10],
  [-17, 10],
  [17, 10],
  [0, 0],
];

function anchorsFor(x: number, y: number, exponent = 1): Anchor[] {
  return receivers.map(([rx, ry]) => ({
    x: rx,
    y: ry,
    distance: Math.max(0.1, Math.hypot(x - rx, y - ry)) ** exponent,
  }));
}

describe('the position fit the floor scene runs', () => {
  it('turns the reference power back into one metre', () => {
    expect(rssiToDistance(-59, -59, 2.5)).toBeCloseTo(1, 6);
  });

  it('recovers a point from exact distances', () => {
    const fit = fitPosition(anchorsFor(6, -4), bounds);
    expect(fit.x).toBeCloseTo(6, 2);
    expect(fit.y).toBeCloseTo(-4, 2);
  });

  it('still finds the point when every distance was read with the wrong path-loss exponent', () => {
    const fit = fitPosition(anchorsFor(11, 6, 3 / 2.5), bounds);
    expect(Math.hypot(fit.x - 11, fit.y - 6)).toBeLessThan(0.1);
  });

  it('never answers outside the floor', () => {
    const anchors = anchorsFor(0, 0).map((anchor, index) => ({
      ...anchor,
      distance: index === 2 ? 0.5 : 80,
    }));
    const fit = fitPosition(anchors, bounds);
    expect(fit.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(fit.x).toBeLessThanOrEqual(bounds.maxX);
    expect(fit.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(fit.y).toBeLessThanOrEqual(bounds.maxY);
  });
});

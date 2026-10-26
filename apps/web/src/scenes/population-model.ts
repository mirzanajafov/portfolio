import { type BufferAttribute, Vector3 } from 'three';

export const learningCurve: [[number, number], ...[number, number][]] = [
  [1, 0.47],
  [2, 0.6],
  [7, 0.69],
  [21, 0.718],
];
export const oracle = 0.77;
export const matchesPerDay = 3;

export function correlationOn(day: number): number {
  let [d0, c0] = learningCurve[0];
  for (const [d1, c1] of learningCurve.slice(1)) {
    if (day <= d1) {
      return c0 + (c1 - c0) * Math.max(0, (day - d0) / (d1 - d0));
    }
    [d0, c0] = [d1, c1];
  }
  return c0;
}

export function blurOn(day: number): number {
  return 3.2 * (1 - correlationOn(day) / oracle) + 0.08;
}

export function greedyMatch(points: BufferAttribute, capacity: number): [number, number][] {
  const neighbors = 6;
  const candidates: { distance: number; i: number; j: number }[] = [];
  const from = new Vector3();
  const to = new Vector3();
  for (let i = 0; i < points.count; i += 1) {
    from.fromBufferAttribute(points, i);
    const best: { distance: number; j: number }[] = [];
    for (let j = 0; j < points.count; j += 1) {
      if (j === i) {
        continue;
      }
      const distance = from.distanceToSquared(to.fromBufferAttribute(points, j));
      const worst = best[neighbors - 1];
      if (worst && distance >= worst.distance) {
        continue;
      }
      if (worst) {
        best.pop();
      }
      best.push({ distance, j });
      best.sort((a, b) => a.distance - b.distance);
    }
    for (const { distance, j } of best) {
      if (i < j) {
        candidates.push({ distance, i, j });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const load = new Uint8Array(points.count);
  const pairs: [number, number][] = [];
  for (const { i, j } of candidates) {
    const loadI = load[i] ?? 0;
    const loadJ = load[j] ?? 0;
    if (loadI < capacity && loadJ < capacity) {
      load[i] = loadI + 1;
      load[j] = loadJ + 1;
      pairs.push([i, j]);
    }
  }
  return pairs;
}

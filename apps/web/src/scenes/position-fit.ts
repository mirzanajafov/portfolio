import { MathUtils } from 'three';

export type Anchor = { x: number; y: number; distance: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Point = { x: number; y: number };

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const axes = [0, 1, 2] as const;

const minRange = 0.1;
const scalePrior = 0.5;
const iterations = 40;

export function rssiToDistance(rssi: number, txPower: number, exponent: number): number {
  return Math.min(1000, Math.max(minRange, 10 ** ((txPower - rssi) / (10 * exponent))));
}

function determinant([a, b, c]: Mat3): number {
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  );
}

function solve3(m: Mat3, [r0, r1, r2]: Vec3): Vec3 | null {
  const det = determinant(m);
  if (Math.abs(det) < 1e-15) {
    return null;
  }
  const [a, b, c] = m;
  return [
    determinant([
      [r0, a[1], a[2]],
      [r1, b[1], b[2]],
      [r2, c[1], c[2]],
    ]) / det,
    determinant([
      [a[0], r0, a[2]],
      [b[0], r1, b[2]],
      [c[0], r2, c[2]],
    ]) / det,
    determinant([
      [a[0], a[1], r0],
      [b[0], b[1], r1],
      [c[0], c[1], r2],
    ]) / det,
  ];
}

type Term = { x: number; y: number; log: number };

function cost(terms: Term[], x: number, y: number, k: number, prior: number): number {
  let total = prior * prior * (k - 1) * (k - 1);
  for (const term of terms) {
    const e = Math.log(Math.max(minRange, Math.hypot(x - term.x, y - term.y))) - k * term.log;
    total += e * e;
  }
  return total;
}

export function fitPosition(anchors: Anchor[], bounds: Bounds): Point {
  let weight = 0;
  let x = 0;
  let y = 0;
  for (const a of anchors) {
    const w = 1 / (a.distance * a.distance + 1);
    weight += w;
    x += w * a.x;
    y += w * a.y;
  }
  if (weight === 0) {
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  }
  x = MathUtils.clamp(x / weight, bounds.minX, bounds.maxX);
  y = MathUtils.clamp(y / weight, bounds.minY, bounds.maxY);
  if (anchors.length < 3) {
    return { x, y };
  }

  const terms = anchors.map((a) => ({ x: a.x, y: a.y, log: Math.log(a.distance) }));
  const scaled = anchors.length >= 4;
  const prior = scaled ? scalePrior : 0;
  let k = 1;
  let damping = 1e-3;
  let current = cost(terms, x, y, k, prior);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const h: Mat3 = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const g: Vec3 = [0, 0, 0];
    for (const term of terms) {
      const dx = x - term.x;
      const dy = y - term.y;
      const r2 = Math.max(minRange * minRange, dx * dx + dy * dy);
      const e = 0.5 * Math.log(r2) - k * term.log;
      const j: Vec3 = [dx / r2, dy / r2, scaled ? -term.log : 0];
      for (const p of axes) {
        g[p] += j[p] * e;
        for (const q of axes) {
          h[p][q] += j[p] * j[q];
        }
      }
    }
    if (scaled) {
      h[2][2] += prior * prior;
      g[2] += prior * prior * (k - 1);
    } else {
      h[2][2] = 1;
    }
    const diagonalScale = 1 + damping;
    const step = solve3(
      [
        [h[0][0] * diagonalScale, h[0][1], h[0][2]],
        [h[1][0], h[1][1] * diagonalScale, h[1][2]],
        [h[2][0], h[2][1], h[2][2] * diagonalScale],
      ],
      [-g[0], -g[1], -g[2]],
    );
    if (!step) {
      break;
    }
    const nx = MathUtils.clamp(x + step[0], bounds.minX, bounds.maxX);
    const ny = MathUtils.clamp(y + step[1], bounds.minY, bounds.maxY);
    const nk = MathUtils.clamp(k + step[2], 0.5, 1.5);
    const next = cost(terms, nx, ny, nk, prior);
    if (next < current) {
      x = nx;
      y = ny;
      k = nk;
      current = next;
      damping = Math.max(1e-6, damping / 3);
      if (Math.hypot(step[0], step[1]) < 1e-3 && Math.abs(step[2]) < 1e-4) {
        break;
      }
    } else {
      damping *= 4;
      if (damping > 1e6) {
        break;
      }
    }
  }
  return { x, y };
}

export type Anchor = { x: number; y: number; distance: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Point = { x: number; y: number };

const minRange = 0.1;
const scalePrior = 0.5;
const iterations = 40;

export function rssiToDistance(rssi: number, txPower: number, exponent: number): number {
  return Math.min(1000, Math.max(minRange, 10 ** ((txPower - rssi) / (10 * exponent))));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function determinant(m: number[][]): number {
  const [a, b, c] = m as [number[], number[], number[]];
  return (
    a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
    a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
    a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)
  );
}

function solve3(m: number[][], rhs: number[]): number[] | null {
  const det = determinant(m);
  if (Math.abs(det) < 1e-15) return null;
  return [0, 1, 2].map(
    (column) =>
      determinant(m.map((row, r) => row.map((value, c) => (c === column ? rhs[r]! : value)))) / det,
  );
}

function cost(
  anchors: Anchor[],
  logs: number[],
  x: number,
  y: number,
  k: number,
  prior: number,
): number {
  let total = prior * prior * (k - 1) * (k - 1);
  anchors.forEach((a, i) => {
    const e = Math.log(Math.max(minRange, Math.hypot(x - a.x, y - a.y))) - k * logs[i]!;
    total += e * e;
  });
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
  if (weight === 0)
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  x = clamp(x / weight, bounds.minX, bounds.maxX);
  y = clamp(y / weight, bounds.minY, bounds.maxY);
  if (anchors.length < 3) return { x, y };

  const logs = anchors.map((a) => Math.log(a.distance));
  const scaled = anchors.length >= 4;
  const prior = scaled ? scalePrior : 0;
  let k = 1;
  let damping = 1e-3;
  let current = cost(anchors, logs, x, y, k, prior);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const h = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const g = [0, 0, 0];
    anchors.forEach((a, i) => {
      const dx = x - a.x;
      const dy = y - a.y;
      const r2 = Math.max(minRange * minRange, dx * dx + dy * dy);
      const e = 0.5 * Math.log(r2) - k * logs[i]!;
      const j = [dx / r2, dy / r2, scaled ? -logs[i]! : 0];
      for (let p = 0; p < 3; p++) {
        g[p]! += j[p]! * e;
        for (let q = 0; q < 3; q++) h[p]![q]! += j[p]! * j[q]!;
      }
    });
    if (scaled) {
      h[2]![2]! += prior * prior;
      g[2]! += prior * prior * (k - 1);
    } else {
      h[2]![2] = 1;
    }
    const damped = h.map((row, p) =>
      row.map((value, q) => (p === q ? value * (1 + damping) : value)),
    );
    const step = solve3(
      damped,
      g.map((value) => -value),
    );
    if (!step) break;
    const nx = clamp(x + step[0]!, bounds.minX, bounds.maxX);
    const ny = clamp(y + step[1]!, bounds.minY, bounds.maxY);
    const nk = clamp(k + step[2]!, 0.5, 1.5);
    const next = cost(anchors, logs, nx, ny, nk, prior);
    if (next < current) {
      x = nx;
      y = ny;
      k = nk;
      current = next;
      damping = Math.max(1e-6, damping / 3);
      if (Math.hypot(step[0]!, step[1]!) < 1e-3 && Math.abs(step[2]!) < 1e-4) break;
    } else {
      damping *= 4;
      if (damping > 1e6) break;
    }
  }
  return { x, y };
}

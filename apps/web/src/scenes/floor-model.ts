import { Vector2 } from 'three';
import { fitPosition, rssiToDistance } from './position-fit';
import { gaussian, pick } from './random';

export const floorParameters = {
  width: 40,
  depth: 25,
  tags: 6,
  walkingSpeed: 1.4,
  readingHz: 10,
  flushMs: 150,
  txPower: -59,
  pathLossExponent: 2.5,
  noiseDb: 3,
  dropRate: 0.08,
  rssiAlpha: 0.2,
  positionAlpha: 0.3,
};

const bounds = { minX: -20, minY: -12.5, maxX: 20, maxY: 12.5 };

export const receiverSpots: [number, number][] = [
  [-17, -10],
  [17, -10],
  [-17, 10],
  [17, 10],
  [0, 0],
];

const rooms: [number, number][] = [
  [-15, 8.5],
  [-5, 8.5],
  [5, 8.5],
  [15, 8.5],
  [-14, -8],
  [0, -6],
  [15, -7],
  [-2, 1],
  [12, 2],
  [-16, 0],
];

type Reading = { x: number; y: number; rssi: number };

type Tag = {
  id: string;
  truth: Vector2;
  estimate: Vector2;
  fitted: boolean;
  readings: Reading[];
  target: Vector2 | null;
};

export function createFloor(random: () => number) {
  const p = floorParameters;
  const tags = Array.from({ length: p.tags }, (_, index): Tag => {
    const [x, y] = pick(random, rooms);
    const truth = new Vector2(x, y);
    return {
      id: (0x3a00 + index * 0x1f7).toString(16),
      truth,
      estimate: truth.clone(),
      fitted: false,
      readings: receiverSpots.map(([rx, ry]) => ({ x: rx, y: ry, rssi: Number.NaN })),
      target: null,
    };
  });
  let readingClock = 0;
  let flushClock = 0;
  let flushes = 0;

  const walk = (dt: number) => {
    for (const tag of tags) {
      if (!tag.target || tag.truth.distanceTo(tag.target) < 0.3) {
        const [x, y] = pick(random, rooms);
        tag.target = new Vector2(x + (random() - 0.5) * 4, y + (random() - 0.5) * 3);
      }
      const direction = tag.target.clone().sub(tag.truth);
      const distance = direction.length();
      if (distance > 0) {
        tag.truth.add(direction.multiplyScalar(Math.min(p.walkingSpeed * dt, distance) / distance));
      }
    }
  };

  const listen = () => {
    for (const tag of tags) {
      for (const reading of tag.readings) {
        if (random() < p.dropRate) {
          continue;
        }
        const range = Math.max(0.1, Math.hypot(tag.truth.x - reading.x, tag.truth.y - reading.y));
        const rssi =
          p.txPower - 10 * p.pathLossExponent * Math.log10(range) + gaussian(random) * p.noiseDb;
        reading.rssi = Number.isNaN(reading.rssi)
          ? rssi
          : p.rssiAlpha * rssi + (1 - p.rssiAlpha) * reading.rssi;
      }
    }
  };

  const fit = () => {
    for (const tag of tags) {
      const anchors = tag.readings.flatMap(({ x, y, rssi }) =>
        Number.isNaN(rssi)
          ? []
          : [{ x, y, distance: rssiToDistance(rssi, p.txPower, p.pathLossExponent) }],
      );
      if (anchors.length === 0) {
        continue;
      }
      const position = fitPosition(anchors, bounds);
      if (tag.fitted) {
        tag.estimate.lerp(new Vector2(position.x, position.y), p.positionAlpha);
      } else {
        tag.estimate.set(position.x, position.y);
        tag.fitted = true;
      }
    }
  };

  return {
    tags,
    flushes: () => flushes,
    error: () =>
      tags.reduce((sum, tag) => sum + tag.estimate.distanceTo(tag.truth), 0) / tags.length,
    step(dt: number): boolean {
      walk(dt);
      readingClock += dt;
      const readingEvery = 1 / p.readingHz;
      while (readingClock >= readingEvery) {
        readingClock -= readingEvery;
        listen();
      }
      flushClock += dt;
      if (flushClock < p.flushMs / 1000) {
        return false;
      }
      flushClock %= p.flushMs / 1000;
      flushes += 1;
      fit();
      return true;
    },
  };
}

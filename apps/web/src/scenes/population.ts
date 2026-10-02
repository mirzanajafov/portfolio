import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
} from 'three';
import { gaussian, seeded } from './random';
import type { SceneFactory } from './types';

export const learningCurve: [number, number][] = [
  [1, 0.47],
  [2, 0.6],
  [7, 0.69],
  [21, 0.718],
];
export const oracle = 0.77;
export const matchesPerDay = 3;

export function correlationOn(day: number): number {
  for (let i = 0; i < learningCurve.length - 1; i += 1) {
    const [d0, c0] = learningCurve[i]!;
    const [d1, c1] = learningCurve[i + 1]!;
    if (day <= d1) {
      return c0 + (c1 - c0) * Math.max(0, (day - d0) / (d1 - d0));
    }
  }
  return learningCurve[learningCurve.length - 1]![1];
}

export function blurOn(day: number): number {
  return 3.2 * (1 - correlationOn(day) / oracle) + 0.08;
}

export function greedyMatch(
  points: Float32Array,
  count: number,
  capacity: number,
): [number, number][] {
  const neighbours = 6;
  const candidates: [number, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    const best: [number, number][] = [];
    const x = points[i * 3]!;
    const y = points[i * 3 + 1]!;
    const z = points[i * 3 + 2]!;
    for (let j = 0; j < count; j += 1) {
      if (j === i) continue;
      const dx = points[j * 3]! - x;
      const dy = points[j * 3 + 1]! - y;
      const dz = points[j * 3 + 2]! - z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (best.length < neighbours) {
        best.push([distance, j]);
        best.sort((a, b) => a[0] - b[0]);
      } else if (distance < best[neighbours - 1]![0]) {
        best[neighbours - 1] = [distance, j];
        best.sort((a, b) => a[0] - b[0]);
      }
    }
    for (const [distance, j] of best) {
      if (i < j) candidates.push([distance, i, j]);
    }
  }
  candidates.sort((a, b) => a[0] - b[0]);
  const load = new Uint8Array(count);
  const pairs: [number, number][] = [];
  for (const [, i, j] of candidates) {
    if (load[i]! < capacity && load[j]! < capacity) {
      load[i]! += 1;
      load[j]! += 1;
      pairs.push([i, j]);
    }
  }
  return pairs;
}

export const createPopulationScene: SceneFactory = (hooks) => {
  const count = hooks.size().width < 600 ? 700 : 1200;
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 500);
  const random = seeded(42);

  const projection = Array.from({ length: 3 }, () =>
    Array.from({ length: 8 }, () => gaussian(random)),
  );
  const truth = new Float32Array(count * 3);
  const direction = new Float32Array(count * 3);
  const shown = new Float32Array(count * 3);
  const firstTrait = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const traits = Array.from({ length: 8 }, () => gaussian(random));
    firstTrait[i] = traits[0]!;
    for (let axis = 0; axis < 3; axis += 1) {
      let value = 0;
      for (let k = 0; k < 8; k += 1) value += projection[axis]![k]! * traits[k]!;
      truth[i * 3 + axis] = value * 2.1;
      direction[i * 3 + axis] = gaussian(random);
    }
  }

  const pointGeometry = new BufferGeometry();
  pointGeometry.setAttribute('position', new BufferAttribute(shown, 3));
  const colours = new Float32Array(count * 3);
  pointGeometry.setAttribute('color', new BufferAttribute(colours, 3));
  const pointMaterial = new PointsMaterial({
    size: 0.34,
    vertexColors: true,
    sizeAttenuation: true,
  });
  scene.add(new Points(pointGeometry, pointMaterial));

  const linePositions = new Float32Array(count * matchesPerDay * 2 * 3);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  const lineMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.3 });
  scene.add(new LineSegments(lineGeometry, lineMaterial));

  let day = 1;
  let dayClock = 0;
  let blur = blurOn(1);
  let blurTarget = blur;
  let pairs: [number, number][] = [];

  const updateShown = () => {
    for (let i = 0; i < count * 3; i += 1) shown[i] = truth[i]! + direction[i]! * blur;
    pointGeometry.attributes.position!.needsUpdate = true;
  };
  const writeLines = () => {
    let offset = 0;
    for (const [i, j] of pairs) {
      for (const index of [i, j]) {
        linePositions[offset++] = shown[index * 3]!;
        linePositions[offset++] = shown[index * 3 + 1]!;
        linePositions[offset++] = shown[index * 3 + 2]!;
      }
    }
    lineGeometry.setDrawRange(0, pairs.length * 2);
    lineGeometry.attributes.position!.needsUpdate = true;
  };
  updateShown();
  pairs = greedyMatch(shown, count, matchesPerDay);
  writeLines();

  return {
    scene,
    camera,
    setColors(palette) {
      const colour = new Color();
      for (let i = 0; i < count; i += 1) {
        colour.copy(palette.signal).lerp(palette.accent, 1 / (1 + Math.exp(-firstTrait[i]! * 1.4)));
        colours[i * 3] = colour.r;
        colours[i * 3 + 1] = colour.g;
        colours[i * 3 + 2] = colour.b;
      }
      pointGeometry.attributes.color!.needsUpdate = true;
      lineMaterial.color.copy(palette.muted);
    },
    step(dt) {
      dayClock += dt;
      if (dayClock > 2.6) {
        dayClock = 0;
        day = day >= 21 ? 1 : day + 1;
        blurTarget = blurOn(day);
        if (day === 1) blur = blurTarget;
        pairs = greedyMatch(shown, count, matchesPerDay);
      }
      blur += (blurTarget - blur) * Math.min(1, dt * 2.2);
      updateShown();
      writeLines();
    },
    render(time) {
      const angle = time * 0.05;
      const far = Math.max(1, 1.3 / camera.aspect);
      camera.position.set(
        Math.sin(angle) * 36 * far,
        (8 + Math.sin(time * 0.03) * 2) * far,
        Math.cos(angle) * 36 * far,
      );
      camera.lookAt(0, -5, 0);
    },
    readout() {
      return [
        `${count} simulated people · 8 dimensions · ${matchesPerDay} matches a day each`,
        `day ${String(day).padStart(2, '0')} of 21 · rank correlation ${correlationOn(day).toFixed(3)} · oracle ${oracle}`,
        `pairs from greedy b-matching today: ${pairs.length}`,
      ];
    },
    dispose() {
      pointGeometry.dispose();
      pointMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
  };
};

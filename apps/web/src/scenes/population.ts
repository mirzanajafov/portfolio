import {
  type BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from 'three';
import { gaussian, seeded } from './random';
import type { SceneFactory } from './types';

export const learningCurve: [[number, number], ...[number, number][]] = [
  [1, 0.47],
  [2, 0.6],
  [7, 0.69],
  [21, 0.718],
];
export const oracle = 0.77;
const matchesPerDay = 3;

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

export const createPopulationScene: SceneFactory = (hooks) => {
  const count = hooks.size().width < 600 ? 700 : 1200;
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 500);
  const random = seeded(42);

  const toneAxis = new Vector3();
  const otherAxes = Array.from({ length: 7 }, () => new Vector3());
  for (const component of [0, 1, 2]) {
    for (const axis of [toneAxis, ...otherAxes]) {
      axis.setComponent(component, gaussian(random));
    }
  }
  const truth = new Float32BufferAttribute(count * 3, 3);
  const direction = new Float32BufferAttribute(count * 3, 3);
  const tones = new Float32Array(count);
  const person = new Vector3();
  for (let i = 0; i < count; i += 1) {
    const tone = gaussian(random);
    person.copy(toneAxis).multiplyScalar(tone);
    for (const axis of otherAxes) {
      person.addScaledVector(axis, gaussian(random));
    }
    person.multiplyScalar(2.1);
    truth.setXYZ(i, person.x, person.y, person.z);
    direction.setXYZ(i, gaussian(random), gaussian(random), gaussian(random));
    tones[i] = tone;
  }

  const shown = new Float32BufferAttribute(count * 3, 3);
  const colors = new Float32BufferAttribute(count * 3, 3);
  const pointGeometry = new BufferGeometry();
  pointGeometry.setAttribute('position', shown);
  pointGeometry.setAttribute('color', colors);
  const pointMaterial = new PointsMaterial({
    size: 0.34,
    vertexColors: true,
    sizeAttenuation: true,
  });
  scene.add(new Points(pointGeometry, pointMaterial));

  const lines = new Float32BufferAttribute(count * matchesPerDay * 2 * 3, 3);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', lines);
  const lineMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.3 });
  scene.add(new LineSegments(lineGeometry, lineMaterial));

  let day = 1;
  let dayClock = 0;
  let blur = blurOn(1);
  let blurTarget = blur;
  let pairs: [number, number][] = [];

  const updateShown = () => {
    for (let i = 0; i < count; i += 1) {
      shown.setXYZ(
        i,
        truth.getX(i) + direction.getX(i) * blur,
        truth.getY(i) + direction.getY(i) * blur,
        truth.getZ(i) + direction.getZ(i) * blur,
      );
    }
    shown.needsUpdate = true;
  };
  const writeLines = () => {
    pairs.forEach(([i, j], index) => {
      lines.setXYZ(index * 2, shown.getX(i), shown.getY(i), shown.getZ(i));
      lines.setXYZ(index * 2 + 1, shown.getX(j), shown.getY(j), shown.getZ(j));
    });
    lineGeometry.setDrawRange(0, pairs.length * 2);
    lines.needsUpdate = true;
  };
  updateShown();
  pairs = greedyMatch(shown, matchesPerDay);
  writeLines();

  return {
    scene,
    camera,
    setColors(palette) {
      const color = new Color();
      tones.forEach((tone, i) => {
        color.copy(palette.signal).lerp(palette.accent, 1 / (1 + Math.exp(-tone * 1.4)));
        colors.setXYZ(i, color.r, color.g, color.b);
      });
      colors.needsUpdate = true;
      lineMaterial.color.copy(palette.muted);
    },
    step(dt) {
      dayClock += dt;
      if (dayClock > 2.6) {
        dayClock = 0;
        day = day >= 21 ? 1 : day + 1;
        blurTarget = blurOn(day);
        if (day === 1) {
          blur = blurTarget;
        }
        pairs = greedyMatch(shown, matchesPerDay);
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

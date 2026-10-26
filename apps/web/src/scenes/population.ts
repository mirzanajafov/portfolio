import {
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
import { blurOn, correlationOn, greedyMatch, matchesPerDay, oracle } from './population-model';
import { gaussian, seeded } from './random';
import type { SceneFactory } from './types';

export const createPopulationScene: SceneFactory = (hooks) => {
  const count = hooks.narrow() ? 700 : 1200;
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
  };
};

import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
} from 'three';
import { createFloor, floorParameters, receiverSpots } from './floor-model';
import { seeded } from './random';
import type { SceneFactory } from './types';

const walls: [number, number, number, number][] = [
  [-20, -12.5, 20, -12.5],
  [20, -12.5, 20, 12.5],
  [20, 12.5, -20, 12.5],
  [-20, 12.5, -20, -12.5],
  [-20, 4.5, -13.5, 4.5],
  [-11.5, 4.5, -3.5, 4.5],
  [-1.5, 4.5, 6.5, 4.5],
  [8.5, 4.5, 20, 4.5],
  [-10, 4.5, -10, 12.5],
  [0, 4.5, 0, 12.5],
  [10, 4.5, 10, 12.5],
  [10, -12.5, 10, -6],
  [10, -3.5, 10, -1],
  [10, -1, 20, -1],
  [-20, -3, -14, -3],
  [-12, -3, -8, -3],
  [-8, -3, -8, -12.5],
];

const trailLength = 40;
const ringLife = 1.6;

type Ring = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; age: number };

export const createFloorScene: SceneFactory = (hooks) => {
  const p = floorParameters;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const group = new Group();
  scene.add(group);
  const random = seeded(11);
  let palette = hooks.palette;

  const wallPoints: number[] = [];
  for (const [x1, y1, x2, y2] of walls) {
    wallPoints.push(x1, 0, y1, x2, 0, y2, x1, 1.4, y1, x2, 1.4, y2);
    wallPoints.push(x1, 0, y1, x1, 1.4, y1, x2, 0, y2, x2, 1.4, y2);
  }
  const wallGeometry = new BufferGeometry();
  wallGeometry.setAttribute('position', new Float32BufferAttribute(wallPoints, 3));
  const wallMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
  group.add(new LineSegments(wallGeometry, wallMaterial));

  const gridPoints: number[] = [];
  for (let x = -20; x <= 20; x += 2) {
    gridPoints.push(x, 0, -12.5, x, 0, 12.5);
  }
  for (let y = -12; y <= 12.5; y += 2) {
    gridPoints.push(-20, 0, y, 20, 0, y);
  }
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute('position', new Float32BufferAttribute(gridPoints, 3));
  const gridMaterial = new LineBasicMaterial();
  group.add(new LineSegments(gridGeometry, gridMaterial));

  const receiverGeometry = new BoxGeometry(0.7, 2.2, 0.7);
  const ringGeometry = new RingGeometry(0.96, 1, 64);
  ringGeometry.rotateX(-Math.PI / 2);
  const receivers = receiverSpots.map(([x, y], index) => {
    const mesh = new Mesh(receiverGeometry, new MeshBasicMaterial());
    mesh.position.set(x, 1.1, y);
    group.add(mesh);
    const rings: Ring[] = [];
    return {
      x,
      y,
      mesh,
      label: hooks.label(`R${index + 1}`, 'signal'),
      rings,
      next: random() * 0.8,
    };
  });

  const floor = createFloor(seeded(7));
  const dotGeometry = new SphereGeometry(0.42, 20, 16);
  const haloGeometry = new RingGeometry(0.55, 0.62, 40);
  const tags = floor.tags.map((tag) => {
    const dot = new Mesh(dotGeometry, new MeshBasicMaterial());
    const halo = new Mesh(
      haloGeometry,
      new MeshBasicMaterial({ transparent: true, opacity: 0.6, side: DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    const trailPositions = new Float32BufferAttribute(trailLength * 3, 3);
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute('position', trailPositions);
    const trailMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.55 });
    group.add(dot, halo, new Line(trailGeometry, trailMaterial));
    return {
      tag,
      dot,
      halo,
      trailPositions,
      trailGeometry,
      trailMaterial,
      count: 0,
      label: hooks.label(`tag ${tag.id}`),
    };
  });

  return {
    scene,
    camera,
    setColors(next) {
      palette = next;
      wallMaterial.color.copy(next.muted);
      gridMaterial.color.copy(next.grid);
      for (const receiver of receivers) {
        receiver.mesh.material.color.copy(next.signal);
      }
      for (const view of tags) {
        view.dot.material.color.copy(next.accent);
        view.halo.material.color.copy(next.fg);
        view.trailMaterial.color.copy(next.accent);
      }
    },
    step(dt) {
      const fitted = floor.step(dt);
      if (fitted) {
        for (const view of tags) {
          const trail = view.trailPositions.array;
          trail.copyWithin(3, 0, trail.length - 3);
          view.trailPositions.setXYZ(0, view.tag.estimate.x, 0.05, view.tag.estimate.y);
          view.count = Math.min(view.count + 1, trailLength);
          view.trailGeometry.setDrawRange(0, view.count);
          view.trailPositions.needsUpdate = true;
        }
      }
      for (const receiver of receivers) {
        receiver.next -= dt;
        if (receiver.next <= 0) {
          receiver.next = 0.6 + random() * 0.9;
          const ring = new Mesh(
            ringGeometry,
            new MeshBasicMaterial({
              color: palette.signal,
              transparent: true,
              opacity: 0.45,
              side: DoubleSide,
            }),
          );
          ring.position.set(receiver.x, 0.02, receiver.y);
          group.add(ring);
          receiver.rings.push({ mesh: ring, age: 0 });
        }
        for (const ring of receiver.rings) {
          ring.age += dt;
          const scale = 0.5 + ring.age * 9;
          ring.mesh.scale.set(scale, scale, scale);
          ring.mesh.material.opacity = Math.max(0, 0.45 * (1 - ring.age / ringLife));
        }
        receiver.rings = receiver.rings.filter((ring) => {
          if (ring.age <= ringLife) {
            return true;
          }
          group.remove(ring.mesh);
          ring.mesh.material.dispose();
          return false;
        });
      }
    },
    render(time) {
      const swing = Math.sin(time * 0.06) * 0.22;
      const far = Math.max(1, 1.5 / camera.aspect);
      camera.position.set(Math.sin(swing) * 46 * far, 34 * far, Math.cos(swing) * 38 * far);
      camera.lookAt(0, -4 * far, 1);
      const narrow = hooks.narrow();
      for (const view of tags) {
        const { estimate, truth } = view.tag;
        view.dot.position.set(estimate.x, 0.42, estimate.y);
        view.halo.position.set(truth.x, 0.03, truth.y);
        hooks.place(view.label, view.dot.position.x, view.dot.position.y, view.dot.position.z);
        hooks.write(view.label, `tag ${view.tag.id} · ±${estimate.distanceTo(truth).toFixed(1)} m`);
        if (narrow) {
          view.label.style.display = 'none';
        }
      }
      for (const receiver of receivers) {
        hooks.place(receiver.label, receiver.x, 2.6, receiver.y);
      }
    },
    readout() {
      return [
        `${p.width} × ${p.depth} m floor · ${receivers.length} receivers · ${p.tags} tags at ${p.walkingSpeed} m/s`,
        `RSSI at ${p.readingHz} Hz with ${p.noiseDb} dB noise · log-distance fit · ${floor.flushes()} batches of ${p.flushMs} ms`,
        `estimate error now ${floor.error().toFixed(2)} m`,
      ];
    },
  };
};

import {
  BoxGeometry,
  BufferAttribute,
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
  Vector2,
} from 'three';
import { fitPosition, rssiToDistance } from './position-fit';
import { gaussian, pick, seeded } from './random';
import type { Palette, SceneFactory } from './types';

const floorParameters = {
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

const receiverSpots: [number, number][] = [
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

const trailLength = 40;

type Ring = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; age: number };

type Receiver = {
  x: number;
  y: number;
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  label: HTMLElement;
  rings: Ring[];
  next: number;
};

type Tag = {
  id: string;
  truth: Vector2;
  estimate: Vector2;
  fitted: boolean;
  readings: { receiver: Receiver; rssi: number }[];
  target: Vector2 | null;
  dot: Mesh<SphereGeometry, MeshBasicMaterial>;
  halo: Mesh<RingGeometry, MeshBasicMaterial>;
  trailPositions: BufferAttribute;
  trailGeometry: BufferGeometry;
  trailMaterial: LineBasicMaterial;
  count: number;
  label: HTMLElement;
};

export const createFloorScene: SceneFactory = (hooks) => {
  const p = floorParameters;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const group = new Group();
  scene.add(group);
  const random = seeded(7);

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
  const receivers = receiverSpots.map(([x, y], index): Receiver => {
    const mesh = new Mesh(receiverGeometry, new MeshBasicMaterial());
    mesh.position.set(x, 1.1, y);
    group.add(mesh);
    return {
      x,
      y,
      mesh,
      label: hooks.label(`R${index + 1}`, 'signal'),
      rings: [],
      next: random() * 0.8,
    };
  });

  const dotGeometry = new SphereGeometry(0.42, 20, 16);
  const haloGeometry = new RingGeometry(0.55, 0.62, 40);
  const tags = Array.from({ length: p.tags }, (_, index): Tag => {
    const [x, y] = pick(random, rooms);
    const truth = new Vector2(x, y);
    const dot = new Mesh(dotGeometry, new MeshBasicMaterial());
    const halo = new Mesh(
      haloGeometry,
      new MeshBasicMaterial({ transparent: true, opacity: 0.6, side: DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    const trailPositions = new BufferAttribute(new Float32Array(trailLength * 3), 3);
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute('position', trailPositions);
    const trailMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.55 });
    group.add(dot, halo, new Line(trailGeometry, trailMaterial));
    const id = (0x3a00 + index * 0x1f7).toString(16);
    return {
      id,
      truth,
      estimate: truth.clone(),
      fitted: false,
      readings: receivers.map((receiver) => ({ receiver, rssi: Number.NaN })),
      target: null,
      dot,
      halo,
      trailPositions,
      trailGeometry,
      trailMaterial,
      count: 0,
      label: hooks.label(`tag ${id}`),
    };
  });

  let palette: Palette | null = null;
  let readingClock = 0;
  let flushClock = 0;
  let flushes = 0;

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
      for (const tag of tags) {
        tag.dot.material.color.copy(next.accent);
        tag.halo.material.color.copy(next.fg);
        tag.trailMaterial.color.copy(next.accent);
      }
    },
    step(dt) {
      for (const tag of tags) {
        if (!tag.target || tag.truth.distanceTo(tag.target) < 0.3) {
          const [x, y] = pick(random, rooms);
          tag.target = new Vector2(x + (random() - 0.5) * 4, y + (random() - 0.5) * 3);
        }
        const direction = tag.target.clone().sub(tag.truth);
        const distance = direction.length();
        if (distance > 0) {
          tag.truth.add(
            direction.multiplyScalar(Math.min(p.walkingSpeed * dt, distance) / distance),
          );
        }
      }
      readingClock += dt;
      const readingEvery = 1 / p.readingHz;
      while (readingClock >= readingEvery) {
        readingClock -= readingEvery;
        for (const tag of tags) {
          for (const reading of tag.readings) {
            if (random() < p.dropRate) {
              continue;
            }
            const { receiver } = reading;
            const range = Math.max(
              0.1,
              Math.hypot(tag.truth.x - receiver.x, tag.truth.y - receiver.y),
            );
            const rssi =
              p.txPower -
              10 * p.pathLossExponent * Math.log10(range) +
              gaussian(random) * p.noiseDb;
            reading.rssi = Number.isNaN(reading.rssi)
              ? rssi
              : p.rssiAlpha * rssi + (1 - p.rssiAlpha) * reading.rssi;
          }
        }
      }
      flushClock += dt;
      if (flushClock >= p.flushMs / 1000) {
        flushClock %= p.flushMs / 1000;
        flushes += 1;
        for (const tag of tags) {
          const anchors = tag.readings.flatMap(({ receiver, rssi }) =>
            Number.isNaN(rssi)
              ? []
              : [
                  {
                    x: receiver.x,
                    y: receiver.y,
                    distance: rssiToDistance(rssi, p.txPower, p.pathLossExponent),
                  },
                ],
          );
          if (anchors.length > 0) {
            const fit = fitPosition(anchors, bounds);
            if (tag.fitted) {
              tag.estimate.lerp(new Vector2(fit.x, fit.y), p.positionAlpha);
            } else {
              tag.estimate.set(fit.x, fit.y);
              tag.fitted = true;
            }
          }
          const trail = tag.trailPositions.array;
          trail.copyWithin(3, 0, trail.length - 3);
          tag.trailPositions.setXYZ(0, tag.estimate.x, 0.05, tag.estimate.y);
          tag.count = Math.min(tag.count + 1, trailLength);
          tag.trailGeometry.setDrawRange(0, tag.count);
          tag.trailPositions.needsUpdate = true;
        }
      }
      for (const receiver of receivers) {
        receiver.next -= dt;
        if (receiver.next <= 0 && palette) {
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
          ring.mesh.material.opacity = Math.max(0, 0.45 * (1 - ring.age / 1.6));
        }
        receiver.rings = receiver.rings.filter((ring) => {
          if (ring.age <= 1.6) {
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
      const narrow = hooks.size().width < 600;
      for (const tag of tags) {
        tag.dot.position.set(tag.estimate.x, 0.42, tag.estimate.y);
        tag.halo.position.set(tag.truth.x, 0.03, tag.truth.y);
        hooks.place(tag.label, tag.dot.position.x, tag.dot.position.y, tag.dot.position.z);
        tag.label.textContent = `tag ${tag.id} · ±${tag.estimate.distanceTo(tag.truth).toFixed(1)} m`;
        if (narrow) {
          tag.label.style.display = 'none';
        }
      }
      for (const receiver of receivers) {
        hooks.place(receiver.label, receiver.x, 2.6, receiver.y);
      }
    },
    readout() {
      const error =
        tags.reduce((sum, tag) => sum + tag.estimate.distanceTo(tag.truth), 0) / tags.length;
      return [
        `${p.width} × ${p.depth} m floor · ${receivers.length} receivers · ${p.tags} tags at ${p.walkingSpeed} m/s`,
        `RSSI at ${p.readingHz} Hz with ${p.noiseDb} dB noise · log-distance fit · ${flushes} batches of ${p.flushMs} ms`,
        `estimate error now ${error.toFixed(2)} m`,
      ];
    },
    dispose() {
      for (const tag of tags) {
        tag.label.remove();
      }
      for (const receiver of receivers) {
        receiver.label.remove();
      }
      for (const geometry of [
        wallGeometry,
        gridGeometry,
        receiverGeometry,
        ringGeometry,
        dotGeometry,
        haloGeometry,
      ]) {
        geometry.dispose();
      }
    },
  };
};

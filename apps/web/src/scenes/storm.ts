import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';
import data from './storm-data.json';
import { seeded } from './random';
import type { Palette, SceneFactory } from './types';

export const stormParameters = {
  secondsPerSecond: 30,
  columns: 7,
  rows: 5,
  spacing: 2,
  cageWidth: 16,
  cageHeight: 7,
  cageDepth: 11,
  gap: 6,
  queueFullMinutes: 25,
};

export type StormSeries = (typeof data.policies)[number];

export const stormData = data;

export function stormSample(series: StormSeries, second: number) {
  const index = Math.min(series.processes.length - 1, Math.max(0, Math.floor(second)));
  return {
    processes: series.processes[index]!,
    running: series.running[index]!,
    goodput: series.goodput[index]!,
    spawns: series.spawns[index]!,
    queuedMinutes: series.backlogSeconds[index]! / 60,
  };
}

export const createStormScene: SceneFactory = (hooks) => {
  const p = stormParameters;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const group = new Group();
  scene.add(group);
  const random = seeded(11);
  const length = data.policies[0]!.processes.length;

  const cageGeometry = new EdgesGeometry(new BoxGeometry(p.cageWidth, p.cageHeight, p.cageDepth));
  const slotGeometry = new BoxGeometry(1.1, 1.1, 1.1);
  const barGeometry = new BoxGeometry(1, 0.22, 0.7);
  const columnGeometry = new BoxGeometry(1.3, 1, 1.3);
  const floorGeometry = new BoxGeometry(p.cageWidth, 0.02, p.cageDepth);

  const cages = data.policies.map((series, index) => {
    const root = new Group();
    group.add(root);
    const frameMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
    const frame = new LineSegments(cageGeometry, frameMaterial);
    frame.position.set(0, p.cageHeight / 2, 0);
    const floorMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.12 });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, 0, 0);
    root.add(frame, floor);

    const slots = Array.from({ length: data.machine.processLimit }, (_, slot) => {
      const material = new MeshBasicMaterial();
      const mesh = new Mesh(slotGeometry, material);
      const column = slot % p.columns;
      const row = Math.floor(slot / p.columns);
      mesh.position.set(
        (column - (p.columns - 1) / 2) * p.spacing,
        0.6,
        (row - (p.rows - 1) / 2) * p.spacing,
      );
      mesh.scale.setScalar(0.001);
      root.add(mesh);
      return { mesh, material, scale: 0 };
    });

    const front = p.cageDepth / 2 + 1.6;
    const trackMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.35 });
    const track = new Mesh(barGeometry, trackMaterial);
    track.scale.x = p.cageWidth;
    track.position.set(0, 0.11, front);
    const usefulMaterial = new MeshBasicMaterial();
    const useful = new Mesh(barGeometry, usefulMaterial);
    useful.position.set(0, 0.12, front);
    const queueMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.55 });
    const queue = new Mesh(columnGeometry, queueMaterial);
    queue.position.set(p.cageWidth / 2 + 1.4, 0, -p.cageDepth / 2 + 0.65);
    root.add(track, useful, queue);

    return {
      series,
      index,
      root,
      front,
      frameMaterial,
      floorMaterial,
      slots,
      trackMaterial,
      useful,
      usefulMaterial,
      queue,
      queueMaterial,
      title: hooks.label(series.label, 'node'),
      usefulLabel: hooks.label('useful work'),
      queueLabel: hooks.label('queued'),
    };
  });
  const burstLabel = hooks.label('burst: arrivals at 1.5× capacity', 'signal');

  let palette: Palette | null = null;
  let second = 0;
  let lastWhole = 0;

  const inBurst = () => {
    const minute = data.startMinute + second / 60;
    return minute >= data.burst.from && minute < data.burst.to;
  };

  return {
    scene,
    camera,
    setColors(next) {
      palette = next;
      for (const cage of cages) {
        cage.floorMaterial.color.copy(next.grid);
        cage.trackMaterial.color.copy(next.muted);
        cage.usefulMaterial.color.copy(next.signal);
        cage.queueMaterial.color.copy(next.fg);
      }
    },
    step(dt) {
      second += dt * p.secondsPerSecond;
      if (second >= length) {
        second = 0;
        lastWhole = 0;
      }
      const whole = Math.floor(second);
      for (const cage of cages) {
        const now = stormSample(cage.series, whole);
        if (whole > lastWhole) {
          const respawned = now.spawns - stormSample(cage.series, lastWhole).spawns;
          for (let k = 0; k < respawned && now.processes > 0; k += 1) {
            cage.slots[Math.floor(random() * now.processes)]!.scale = 0;
          }
        }
        cage.slots.forEach((slot, index) => {
          const target = index < now.processes ? (index < now.running ? 1 : 0.55) : 0;
          slot.scale += (target - slot.scale) * Math.min(1, dt * 6);
          slot.mesh.scale.setScalar(Math.max(0.001, slot.scale));
          if (palette) {
            slot.material.color.copy(index < now.running ? palette.accent : palette.muted);
          }
        });
        const share = Math.min(1, now.goodput);
        cage.useful.scale.x = Math.max(0.001, p.cageWidth * share);
        cage.useful.position.x = -p.cageWidth / 2 + (p.cageWidth * share) / 2;
        const height = Math.max(0.001, (now.queuedMinutes / p.queueFullMinutes) * p.cageHeight);
        cage.queue.scale.y = height;
        cage.queue.position.y = height / 2;
        if (palette) {
          cage.frameMaterial.color.copy(inBurst() ? palette.accent : palette.line);
        }
      }
      lastWhole = whole;
    },
    render(time) {
      const swing = Math.sin(time * 0.05) * 0.16;
      const narrow = hooks.size().width < 600;
      const stacked = narrow || camera.aspect < 1.05;
      for (const cage of cages) {
        const side = cage.index === 0 ? -1 : 1;
        if (stacked) {
          cage.root.position.set(0, 0, side * (p.cageDepth / 2 + p.gap / 2 + 1.5));
        } else {
          cage.root.position.set(side * (p.cageWidth / 2 + p.gap / 2 + 0.8), 0, 0);
        }
        const { x, z } = cage.root.position;
        hooks.place(cage.title, x, p.cageHeight + 1.3, z - p.cageDepth / 2);
        hooks.place(cage.usefulLabel, x - p.cageWidth / 2 + 2.2, 0.2, z + cage.front + 1.2);
        hooks.place(cage.queueLabel, x + p.cageWidth / 2 + 1.4, 0.2, z - p.cageDepth / 2 - 1.2);
        cage.usefulLabel.style.display = narrow ? 'none' : '';
        cage.queueLabel.style.display = narrow ? 'none' : '';
      }
      if (stacked) {
        const far = Math.max(1, 0.62 / camera.aspect);
        camera.position.set(Math.sin(swing) * 24 * far, 64 * far, Math.cos(swing) * 40 * far);
        camera.lookAt(0, 0, 1);
      } else {
        const far = Math.max(1, 1.55 / camera.aspect);
        camera.position.set(Math.sin(swing) * 46 * far, 34 * far, Math.cos(swing) * 50 * far);
        camera.lookAt(0, 1.5, 1);
      }
      if (stacked) {
        hooks.place(burstLabel, 0, 0.2, 1.2);
      } else {
        hooks.place(burstLabel, 0, p.cageHeight + 3.4, -p.cageDepth / 2);
      }
      burstLabel.style.display = inBurst() ? '' : 'none';
    },
    readout() {
      const minute = Math.floor(data.startMinute + second / 60);
      const load = inBurst() ? data.burst.load : data.baseLoad;
      const [box, pool] = cages.map((cage) => stormSample(cage.series, second));
      return [
        `simulated minute ${minute} · arrivals at ${load}× capacity · ${data.machine.cores} CPUs, ${data.machine.processLimit} processes`,
        `the box: ${box!.processes} processes · ${box!.spawns} spawns so far · ${Math.round(Math.min(1, box!.goodput) * 100)}% useful · ${box!.queuedMinutes.toFixed(1)} min queued`,
        `the pool: ${pool!.processes} processes · ${Math.round(Math.min(1, pool!.goodput) * 100)}% useful · ${pool!.queuedMinutes.toFixed(1)} min queued`,
      ];
    },
    dispose() {
      for (const cage of cages) {
        cage.title.remove();
        cage.usefulLabel.remove();
        cage.queueLabel.remove();
        for (const slot of cage.slots) slot.material.dispose();
        cage.frameMaterial.dispose();
        cage.floorMaterial.dispose();
        cage.trackMaterial.dispose();
        cage.usefulMaterial.dispose();
        cage.queueMaterial.dispose();
      }
      burstLabel.remove();
      for (const geometry of [
        cageGeometry,
        slotGeometry,
        barGeometry,
        columnGeometry,
        floorGeometry,
      ]) {
        geometry.dispose();
      }
    },
  };
};

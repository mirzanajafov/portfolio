import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Vector3,
} from 'three';
import data from './campaign-data.json';
import { aim, viewFrom } from './framing';
import { seeded } from './random';
import { formatClock, formatNumber, plural } from './readout';
import type { Palette, SceneFactory } from './types';

export const campaignParameters = {
  runsPerSecond: 10,
  mutantSeconds: 0.6,
  holdSeconds: 3.5,
  clearSeconds: 0.8,
  columns: 20,
  spacing: 1.15,
  tile: 0.82,
  mutantSpacing: 1.6,
  killsPerSpark: 4,
  tilt: 0.92,
  swing: 0.06,
};

export const campaignData = data;

type Run = (typeof data.runs)[number];

const [firstRun] = data.runs;
if (!firstRun) {
  throw new Error('the campaign data has no runs');
}

const p = campaignParameters;
const runCount = data.runs.length;
const rows = Math.ceil(runCount / p.columns);
const runsEnd = runCount / p.runsPerSecond;
const mutantsEnd = runsEnd + data.mutants.length * p.mutantSeconds;
const holdEnd = mutantsEnd + p.holdSeconds;
export const campaignLoop = holdEnd + p.clearSeconds;

const runAppears = (index: number) => index / p.runsPerSecond;
const mutantAppears = (index: number) => runsEnd + index * p.mutantSeconds;

function countUpTo(seconds: number, appears: (index: number) => number, total: number): number {
  let count = 0;
  while (count < total && appears(count) <= seconds + 1e-9) {
    count += 1;
  }
  return count;
}

export function campaignAt(seconds: number) {
  const runs = countUpTo(seconds, runAppears, runCount);
  const mutants = countUpTo(seconds, mutantAppears, data.mutants.length);
  const shown = data.runs.slice(0, runs);
  const total = (pick: (run: Run) => number) => shown.reduce((sum, run) => sum + pick(run), 0);
  return {
    runs,
    mutants,
    journeys: total((run) => run.journeys),
    kills: total((run) => run.kills),
    crashes: total((run) => run.postgres + run.kafka),
    violations: total((run) => run.violations),
    caught: data.mutants.slice(0, mutants).filter((mutant) => mutant.caughtIn !== null).length,
  };
}

const gridCenterZ = -2;
const gridWidth = p.columns * p.spacing;
const gridDepth = rows * p.spacing;
const gridBack = gridCenterZ - gridDepth / 2;
const gridFront = gridCenterZ + gridDepth / 2;
const mutantZ = gridFront + 2;
const mutantHeight = 0.9;

function runPosition(index: number) {
  const column = index % p.columns;
  const row = Math.floor(index / p.columns);
  return {
    x: (column - (p.columns - 1) / 2) * p.spacing,
    z: gridBack + (row + 0.5) * p.spacing,
  };
}

function mutantX(index: number) {
  return (index - (data.mutants.length - 1) / 2) * p.mutantSpacing;
}

function runHeight(kills: number) {
  return 0.25 + kills / 60;
}

const framePoints = [-1, 1].flatMap((side) => [
  new Vector3((side * gridWidth) / 2, 2.9, gridBack),
  new Vector3((side * gridWidth) / 2, 1.4, gridFront),
  new Vector3((side * gridWidth) / 2, 0, mutantZ + 2.2),
]);
const center = new Vector3(0, 0.8, (gridBack + mutantZ) / 2);

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
};
type Ring = { x: number; z: number; age: number };

const faceShades = [0.74, 0.74, 1, 0.5, 0.86, 0.62];
const sparkLife = 0.9;
const ringLife = 0.7;
const maxSparks = 500;
const maxRings = 80;

function ease(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  return 1 - (1 - clamped) ** 3;
}

export const createCampaignScene: SceneFactory = (hooks) => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const random = seeded(17);

  const boxGeometry = new BoxGeometry(1, 1, 1);
  boxGeometry.translate(0, 0.5, 0);
  boxGeometry.setAttribute(
    'color',
    new Float32BufferAttribute(
      faceShades.flatMap((shade) => Array.from({ length: 4 }, () => [shade, shade, shade]).flat()),
      3,
    ),
  );
  const sparkGeometry = new BoxGeometry(0.14, 0.14, 0.14);
  const ringGeometry = new RingGeometry(0.92, 1, 40);
  ringGeometry.rotateX(-Math.PI / 2);
  const gridFloorGeometry = new PlaneGeometry(gridWidth + 0.6, gridDepth + 0.6);
  gridFloorGeometry.rotateX(-Math.PI / 2);
  const mutantFloorGeometry = new PlaneGeometry(gridWidth + 0.6, 1.9);
  mutantFloorGeometry.rotateX(-Math.PI / 2);
  const gridFrameGeometry = new EdgesGeometry(gridFloorGeometry);
  const mutantFrameGeometry = new EdgesGeometry(mutantFloorGeometry);

  const floorMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.12 });
  const frameMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
  const gridFloor = new Mesh(gridFloorGeometry, floorMaterial);
  gridFloor.position.set(0, 0, gridCenterZ);
  const mutantFloor = new Mesh(mutantFloorGeometry, floorMaterial);
  mutantFloor.position.set(0, 0, mutantZ);
  const gridFrame = new LineSegments(gridFrameGeometry, frameMaterial);
  gridFrame.position.copy(gridFloor.position);
  const mutantFrame = new LineSegments(mutantFrameGeometry, frameMaterial);
  mutantFrame.position.copy(mutantFloor.position);
  scene.add(gridFloor, mutantFloor, gridFrame, mutantFrame);

  const instanced = (geometry: BoxGeometry | RingGeometry, count: number) => {
    const mesh = new InstancedMesh(
      geometry,
      new MeshBasicMaterial({ vertexColors: geometry === boxGeometry }),
      count,
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    const white = new Color(1, 1, 1);
    for (let i = 0; i < count; i += 1) {
      mesh.setColorAt(i, white);
    }
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  };
  const runTiles = instanced(boxGeometry, runCount);
  const mutantTiles = instanced(boxGeometry, data.mutants.length);
  const sparkMesh = instanced(sparkGeometry, maxSparks);
  const ringMesh = instanced(ringGeometry, maxRings);

  const gridTitle = hooks.label('');
  const mutantTitle = hooks.label('', 'node');
  const mutantLabel = hooks.label('');

  let palette: Palette | null = null;
  let seconds = mutantsEnd - 2;
  let sparks: Particle[] = [];
  let rings: Ring[] = [];
  let pendingRings: (Ring & { delay: number })[] = [];
  const matrix = new Matrix4();
  const color = new Color();

  const burst = (run: Run, index: number) => {
    const { x, z } = runPosition(index);
    const top = runHeight(run.kills);
    const count = Math.round(run.kills / p.killsPerSpark);
    for (let i = 0; i < count && sparks.length < maxSparks; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 0.6 + random() * 1.4;
      sparks.push({
        x,
        y: top,
        z,
        vx: Math.cos(angle) * speed,
        vy: 2.6 + random() * 2.2,
        vz: Math.sin(angle) * speed,
        age: 0,
      });
    }
    for (let i = 0; i < run.postgres + run.kafka; i += 1) {
      pendingRings.push({ x, z, age: 0, delay: i * 0.09 });
    }
  };

  return {
    scene,
    camera,
    setColors(next) {
      palette = next;
      floorMaterial.color.copy(next.grid);
      frameMaterial.color.copy(next.line);
    },
    step(dt) {
      const before = seconds;
      seconds += dt;
      if (seconds >= campaignLoop) {
        seconds = 0;
        sparks = [];
        rings = [];
        pendingRings = [];
        burst(firstRun, 0);
        return;
      }
      data.runs.forEach((run, index) => {
        const at = runAppears(index);
        if (at > before && at <= seconds) {
          burst(run, index);
        }
      });
      sparks = sparks.filter((spark) => {
        spark.age += dt;
        spark.vy -= 9 * dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.z += spark.vz * dt;
        return spark.age < sparkLife && spark.y > -0.2;
      });
      pendingRings = pendingRings.filter((ring) => {
        ring.delay -= dt;
        if (ring.delay > 0) {
          return true;
        }
        if (rings.length < maxRings) {
          rings.push({ x: ring.x, z: ring.z, age: 0 });
        }
        return false;
      });
      rings = rings.filter((ring) => {
        ring.age += dt;
        return ring.age < ringLife;
      });
    },
    render(time) {
      const narrow = hooks.size().width < 600;
      const clearing = seconds > holdEnd ? 1 - ease((seconds - holdEnd) / p.clearSeconds) : 1;
      const now = campaignAt(seconds);

      runTiles.count = now.runs;
      data.runs.forEach((run, index) => {
        if (index >= now.runs) {
          return;
        }
        const { x, z } = runPosition(index);
        const age = seconds - runAppears(index);
        const grow = ease(age / 0.35) * clearing;
        const height = Math.max(0.001, runHeight(run.kills) * grow);
        matrix.makeScale(p.tile, height, p.tile).setPosition(x, 0, z);
        runTiles.setMatrixAt(index, matrix);
        if (palette) {
          color.copy(palette.fg).lerp(palette.signal, ease(age / 0.6));
          if (run.violations > 0) {
            color.copy(palette.accent);
          }
          runTiles.setColorAt(index, color);
        }
      });
      runTiles.instanceMatrix.needsUpdate = true;
      if (runTiles.instanceColor) {
        runTiles.instanceColor.needsUpdate = true;
      }

      mutantTiles.count = now.mutants;
      data.mutants.slice(0, now.mutants).forEach((mutant, index) => {
        const age = seconds - mutantAppears(index);
        const height = Math.max(0.001, mutantHeight * ease(age / 0.3) * clearing);
        matrix.makeScale(p.tile, height, p.tile).setPosition(mutantX(index), 0, mutantZ);
        mutantTiles.setMatrixAt(index, matrix);
        if (palette) {
          const settled = mutant.caughtIn === null ? palette.muted : palette.accent;
          color.copy(palette.fg).lerp(settled, ease(age / 0.5));
          mutantTiles.setColorAt(index, color);
        }
      });
      mutantTiles.instanceMatrix.needsUpdate = true;
      if (mutantTiles.instanceColor) {
        mutantTiles.instanceColor.needsUpdate = true;
      }

      sparkMesh.count = sparks.length;
      sparks.forEach((spark, index) => {
        const fade = 1 - spark.age / sparkLife;
        matrix.makeScale(fade, fade, fade).setPosition(spark.x, spark.y, spark.z);
        sparkMesh.setMatrixAt(index, matrix);
        if (palette) {
          sparkMesh.setColorAt(index, color.copy(palette.accent).lerp(palette.bg, 1 - fade));
        }
      });
      sparkMesh.instanceMatrix.needsUpdate = true;
      if (sparkMesh.instanceColor) {
        sparkMesh.instanceColor.needsUpdate = true;
      }

      ringMesh.count = rings.length;
      rings.forEach((ring, index) => {
        const progress = ring.age / ringLife;
        const radius = 0.5 + progress * 1.4;
        matrix.makeScale(radius, 1, radius).setPosition(ring.x, 0.03, ring.z);
        ringMesh.setMatrixAt(index, matrix);
        if (palette) {
          ringMesh.setColorAt(index, color.copy(palette.accent).lerp(palette.bg, progress));
        }
      });
      ringMesh.instanceMatrix.needsUpdate = true;
      if (ringMesh.instanceColor) {
        ringMesh.instanceColor.needsUpdate = true;
      }

      gridTitle.textContent = narrow
        ? `deployed code · ${now.runs} runs · ${now.violations} violations`
        : `the deployed code · ${now.runs} of ${runCount} runs · ${now.violations} violations`;
      hooks.place(gridTitle, 0, 1.5, gridBack);
      mutantTitle.textContent =
        now.mutants === 0
          ? 'one guard removed'
          : `one guard removed · ${now.caught} of ${now.mutants} caught`;
      hooks.place(mutantTitle, 0, 0, mutantZ + 0.95);
      const latest = data.mutants[now.mutants - 1];
      if (latest && seconds <= holdEnd) {
        mutantLabel.textContent =
          latest.caughtIn === null
            ? `${latest.id} · survived`
            : `${latest.id} · ${latest.caughtBy.join(' ')}`;
        hooks.place(mutantLabel, mutantX(now.mutants - 1), mutantHeight + 0.2, mutantZ);
      } else {
        mutantLabel.style.display = 'none';
      }

      aim(
        camera,
        framePoints,
        viewFrom(p.tilt, Math.sin(time * 0.05) * p.swing),
        { top: narrow ? 0.84 : 0.7, side: 0.92, bottom: 0.92 },
        center,
      );
    },
    readout() {
      const now = campaignAt(seconds);
      const latest = data.mutants[now.mutants - 1];
      if (latest) {
        return [
          latest.caughtIn === null
            ? `${latest.id}, ${latest.guard}: survived ${latest.runs} runs, as it should`
            : `${latest.id}, ${latest.guard}: caught by ${latest.caughtBy.join(', ')} in run ${latest.caughtIn}`,
          `the deployed code: ${runCount} runs · ${formatNumber(now.journeys)} journeys · ${formatNumber(now.kills)} kills · ${now.violations} violations`,
          `one guard removed: ${now.caught} of ${now.mutants} mutants caught`,
        ];
      }
      const run = data.runs[now.runs - 1] ?? firstRun;
      return [
        `run ${now.runs} of ${runCount} · ${formatNumber(now.kills)} process kills so far · ${now.violations} violations`,
        `${formatClock(run.minute)} into the night · seed ${run.seed} · ${run.journeys} journeys · ${run.kills} kills · ${plural(run.postgres + run.kafka, 'crash', 'crashes')}`,
        `so far: ${formatNumber(now.journeys)} journeys · ${formatNumber(now.crashes)} Postgres and Kafka crashes`,
      ];
    },
    dispose() {
      gridTitle.remove();
      mutantTitle.remove();
      mutantLabel.remove();
      for (const mesh of [runTiles, mutantTiles, sparkMesh, ringMesh]) {
        mesh.material.dispose();
        mesh.dispose();
      }
      floorMaterial.dispose();
      frameMaterial.dispose();
      for (const geometry of [
        boxGeometry,
        sparkGeometry,
        ringGeometry,
        gridFloorGeometry,
        mutantFloorGeometry,
        gridFrameGeometry,
        mutantFrameGeometry,
      ]) {
        geometry.dispose();
      }
    },
  };
};

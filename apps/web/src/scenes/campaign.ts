import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Vector3,
} from 'three';
import {
  campaignAt,
  campaignData,
  campaignLoop,
  campaignPace,
  holdEnd,
  mutantAppears,
  mutantsEnd,
  runAppears,
  type Run,
} from './campaign-model';
import { aim, viewFrom } from './framing';
import { instances } from './instances';
import { seeded } from './random';
import { formatClock, formatNumber, plural } from './readout';
import type { SceneFactory } from './types';

const look = {
  columns: 20,
  spacing: 1.15,
  tile: 0.82,
  mutantSpacing: 1.6,
  killsPerSpark: 4,
  tilt: 0.92,
  swing: 0.06,
};

const { runs, mutants } = campaignData;
const rows = Math.ceil(runs.length / look.columns);
const gridCenterZ = -2;
const gridWidth = look.columns * look.spacing;
const gridDepth = rows * look.spacing;
const gridBack = gridCenterZ - gridDepth / 2;
const gridFront = gridCenterZ + gridDepth / 2;
const mutantZ = gridFront + 2;
const mutantHeight = 0.9;

function runPosition(index: number) {
  const column = index % look.columns;
  const row = Math.floor(index / look.columns);
  return {
    x: (column - (look.columns - 1) / 2) * look.spacing,
    z: gridBack + (row + 0.5) * look.spacing,
  };
}

function mutantX(index: number) {
  return (index - (mutants.length - 1) / 2) * look.mutantSpacing;
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
  return 1 - (1 - MathUtils.clamp(value, 0, 1)) ** 3;
}

export const createCampaignScene: SceneFactory = (hooks) => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const random = seeded(17);
  let palette = hooks.palette;

  const boxGeometry = new BoxGeometry(1, 1, 1);
  boxGeometry.translate(0, 0.5, 0);
  boxGeometry.setAttribute(
    'color',
    new Float32BufferAttribute(
      faceShades.flatMap((shade) => Array.from({ length: 4 }, () => [shade, shade, shade]).flat()),
      3,
    ),
  );
  const ringGeometry = new RingGeometry(0.92, 1, 40);
  ringGeometry.rotateX(-Math.PI / 2);
  const gridFloorGeometry = new PlaneGeometry(gridWidth + 0.6, gridDepth + 0.6);
  gridFloorGeometry.rotateX(-Math.PI / 2);
  const mutantFloorGeometry = new PlaneGeometry(gridWidth + 0.6, 1.9);
  mutantFloorGeometry.rotateX(-Math.PI / 2);

  const floorMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.12 });
  const frameMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
  const gridFloor = new Mesh(gridFloorGeometry, floorMaterial);
  gridFloor.position.set(0, 0, gridCenterZ);
  const mutantFloor = new Mesh(mutantFloorGeometry, floorMaterial);
  mutantFloor.position.set(0, 0, mutantZ);
  const gridFrame = new LineSegments(new EdgesGeometry(gridFloorGeometry), frameMaterial);
  gridFrame.position.copy(gridFloor.position);
  const mutantFrame = new LineSegments(new EdgesGeometry(mutantFloorGeometry), frameMaterial);
  mutantFrame.position.copy(mutantFloor.position);

  const shaded = () => new MeshBasicMaterial({ vertexColors: true });
  const runTiles = instances(boxGeometry, shaded(), runs.length);
  const mutantTiles = instances(boxGeometry, shaded(), mutants.length);
  const sparkMesh = instances(
    new BoxGeometry(0.14, 0.14, 0.14),
    new MeshBasicMaterial(),
    maxSparks,
  );
  const ringMesh = instances(ringGeometry, new MeshBasicMaterial(), maxRings);
  scene.add(
    gridFloor,
    mutantFloor,
    gridFrame,
    mutantFrame,
    runTiles,
    mutantTiles,
    sparkMesh,
    ringMesh,
  );

  const gridTitle = hooks.label('');
  const mutantTitle = hooks.label('', 'node');
  const mutantLabel = hooks.label('');

  let seconds = mutantsEnd - 2;
  let sparks: Particle[] = [];
  let rings: Ring[] = [];
  let pendingRings: (Ring & { delay: number })[] = [];
  const matrix = new Matrix4();
  const color = new Color();

  const burst = (run: Run, index: number) => {
    const { x, z } = runPosition(index);
    const top = runHeight(run.kills);
    const count = Math.round(run.kills / look.killsPerSpark);
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
        burst(campaignAt(0).run, 0);
        return;
      }
      runs.forEach((run, index) => {
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
      const narrow = hooks.narrow();
      const clearing =
        seconds > holdEnd ? 1 - ease((seconds - holdEnd) / campaignPace.clearSeconds) : 1;
      const now = campaignAt(seconds);

      runTiles.count = now.runs;
      for (const [index, run] of runs.entries()) {
        if (index >= now.runs) {
          break;
        }
        const { x, z } = runPosition(index);
        const age = seconds - runAppears(index);
        const grow = ease(age / 0.35) * clearing;
        const height = Math.max(0.001, runHeight(run.kills) * grow);
        matrix.makeScale(look.tile, height, look.tile).setPosition(x, 0, z);
        runTiles.setMatrixAt(index, matrix);
        color.copy(palette.fg).lerp(palette.signal, ease(age / 0.6));
        if (run.violations > 0) {
          color.copy(palette.accent);
        }
        runTiles.setColorAt(index, color);
      }

      mutantTiles.count = now.mutants;
      for (const [index, mutant] of mutants.entries()) {
        if (index >= now.mutants) {
          break;
        }
        const age = seconds - mutantAppears(index);
        const height = Math.max(0.001, mutantHeight * ease(age / 0.3) * clearing);
        matrix.makeScale(look.tile, height, look.tile).setPosition(mutantX(index), 0, mutantZ);
        mutantTiles.setMatrixAt(index, matrix);
        const settled = mutant.caughtIn === null ? palette.muted : palette.accent;
        color.copy(palette.fg).lerp(settled, ease(age / 0.5));
        mutantTiles.setColorAt(index, color);
      }

      sparkMesh.count = sparks.length;
      sparks.forEach((spark, index) => {
        const fade = 1 - spark.age / sparkLife;
        matrix.makeScale(fade, fade, fade).setPosition(spark.x, spark.y, spark.z);
        sparkMesh.setMatrixAt(index, matrix);
        sparkMesh.setColorAt(index, color.copy(palette.accent).lerp(palette.bg, 1 - fade));
      });

      ringMesh.count = rings.length;
      rings.forEach((ring, index) => {
        const progress = ring.age / ringLife;
        const radius = 0.5 + progress * 1.4;
        matrix.makeScale(radius, 1, radius).setPosition(ring.x, 0.03, ring.z);
        ringMesh.setMatrixAt(index, matrix);
        ringMesh.setColorAt(index, color.copy(palette.accent).lerp(palette.bg, progress));
      });

      for (const mesh of [runTiles, mutantTiles, sparkMesh, ringMesh]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }

      hooks.write(
        gridTitle,
        narrow
          ? `deployed code · ${now.runs} runs · ${now.violations} violations`
          : `the deployed code · ${now.runs} of ${runs.length} runs · ${now.violations} violations`,
      );
      hooks.place(gridTitle, 0, 1.5, gridBack);
      hooks.write(
        mutantTitle,
        now.mutants === 0
          ? 'one guard removed'
          : `one guard removed · ${now.caught} of ${now.mutants} caught`,
      );
      hooks.place(mutantTitle, 0, 0, mutantZ + 0.95);
      if (now.mutant && seconds <= holdEnd) {
        hooks.write(
          mutantLabel,
          now.mutant.caughtIn === null
            ? `${now.mutant.id} · survived`
            : `${now.mutant.id} · ${now.mutant.caughtBy.join(' ')}`,
        );
        hooks.place(mutantLabel, mutantX(now.mutants - 1), mutantHeight + 0.2, mutantZ);
      } else {
        mutantLabel.style.display = 'none';
      }

      aim(
        camera,
        framePoints,
        viewFrom(look.tilt, Math.sin(time * 0.05) * look.swing),
        { top: narrow ? 0.84 : 0.7, side: 0.92, bottom: 0.92 },
        center,
      );
    },
    readout() {
      const now = campaignAt(seconds);
      const { mutant, run } = now;
      if (mutant) {
        return [
          mutant.caughtIn === null
            ? `${mutant.id}, ${mutant.guard}: survived ${mutant.runs} runs, as it should`
            : `${mutant.id}, ${mutant.guard}: caught by ${mutant.caughtBy.join(', ')} in run ${mutant.caughtIn}`,
          `the deployed code: ${runs.length} runs · ${formatNumber(now.journeys)} journeys · ${formatNumber(now.kills)} kills · ${now.violations} violations`,
          `one guard removed: ${now.caught} of ${now.mutants} mutants caught`,
        ];
      }
      return [
        `run ${now.runs} of ${runs.length} · ${formatNumber(now.kills)} process kills so far · ${now.violations} violations`,
        `${formatClock(run.minute)} into the night · seed ${run.seed} · ${run.journeys} journeys · ${run.kills} kills · ${plural(run.postgres + run.kafka, 'crash', 'crashes')}`,
        `so far: ${formatNumber(now.journeys)} journeys · ${formatNumber(now.crashes)} Postgres and Kafka crashes`,
      ];
    },
  };
};

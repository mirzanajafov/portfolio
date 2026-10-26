import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three';
import data from './failover-data.json';
import { aim, frame, viewFrom } from './framing';
import { seeded } from './random';
import { formatNumber } from './readout';
import { commonLength, sampleAt } from './series';
import type { Palette, SceneFactory } from './types';

const failoverParameters = {
  pace: [
    { until: -400, speed: 2 },
    { until: 2000, speed: 0.25 },
    { until: 29600, speed: 6 },
  ],
  finalSpeed: 2,
  dotsPerSecond: 42,
  maxDots: 200,
  flight: 0.95,
  hop: 0.55,
  lostPerUnit: 520,
  portalRadius: 1.05,
  swing: 0.06,
  startMs: 300,
};

type FailoverLane = (typeof data.lanes)[number];

export const failoverData = data;

const bins = commonLength(
  data.lanes.flatMap((lane) => [lane.requests, lane.served, lane.failed, lane.retried]),
);
const endMs = data.fromMs + bins * data.binMs;

export function speedAt(ms: number): number {
  const { pace, finalSpeed } = failoverParameters;
  return pace.find((step) => ms < step.until)?.speed ?? finalSpeed;
}

function binAt(ms: number): number {
  return MathUtils.clamp(Math.floor((ms - data.fromMs) / data.binMs), 0, bins - 1);
}

export function laneAt(lane: FailoverLane, ms: number) {
  const position = MathUtils.clamp((ms - data.fromMs) / data.binMs, 0, bins);
  const whole = Math.floor(position);
  let lost = 0;
  let retried = 0;
  for (let i = 0; i < whole; i += 1) {
    lost += sampleAt(lane.failed, i);
    retried += sampleAt(lane.retried, i);
  }
  const bin = binAt(ms);
  const part = position - whole;
  if (part > 0) {
    lost += sampleAt(lane.failed, bin) * part;
    retried += sampleAt(lane.retried, bin) * part;
  }
  const requests = Math.max(1, sampleAt(lane.requests, bin));
  const sentToA =
    sampleAt(lane.served, bin) + sampleAt(lane.failed, bin) + sampleAt(lane.retried, bin);
  return {
    lost: Math.floor(lost),
    retried: Math.floor(retried),
    toA: sentToA / requests,
  };
}

export function stateOfA(lane: FailoverLane, ms: number): 'up' | 'picked' | 'out' | 'back' {
  if (ms < 0) {
    return 'up';
  }
  const last = lane.events.filter((e) => e.atMs <= ms).at(-1);
  const out = last !== undefined && (last.state === 'ejected' || last.state === 'unhealthy');
  if (ms < data.clearMs) {
    return out ? 'out' : 'picked';
  }
  return out ? 'out' : 'back';
}

const fates = ['served', 'failed', 'retried', 'other'] as const;

type Fate = (typeof fates)[number];

const nothingOwed = (): Record<Fate, number> => ({
  served: 0.5,
  failed: 0.5,
  retried: 0.5,
  other: 0.5,
});

function countsBetween(lane: FailoverLane, from: number, to: number): Record<Fate, number> {
  const counts = { served: 0, failed: 0, retried: 0, other: 0 };
  for (let bin = binAt(from); bin <= binAt(to - 1e-6); bin += 1) {
    const start = data.fromMs + bin * data.binMs;
    const overlap = Math.max(0, Math.min(to, start + data.binMs) - Math.max(from, start));
    const share = overlap / data.binMs;
    const served = sampleAt(lane.served, bin);
    const failed = sampleAt(lane.failed, bin);
    const retried = sampleAt(lane.retried, bin);
    counts.served += served * share;
    counts.failed += failed * share;
    counts.retried += retried * share;
    counts.other += Math.max(0, sampleAt(lane.requests, bin) - served - failed - retried) * share;
  }
  return counts;
}

type Dot = {
  fate: Fate;
  phase: 'fly' | 'enter' | 'lost' | 'hop';
  t: number;
  duration: number;
  from: Vector3;
  to: Vector3;
  arc: number;
  alarm: boolean;
};

const dimensions = [
  { name: 'a', x: -3.4 },
  { name: 'b', x: 0 },
  { name: 'c', x: 3.4 },
] as const;
const portalZ = -1.7;
const gateway = new Vector3(0, 1.0, 2.3);
const lostSpot = { x: -4.2, z: 2.3 };
const laneBox = { minX: -5.0, maxX: 4.7, minZ: -3.0, maxZ: 3.2, height: 3.6 };

export const createFailoverScene: SceneFactory = (hooks) => {
  const p = failoverParameters;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);
  const random = seeded(7);

  const floorGeometry = new PlaneGeometry(laneBox.maxX - laneBox.minX, laneBox.maxZ - laneBox.minZ);
  const frameGeometry = new EdgesGeometry(
    new BoxGeometry(laneBox.maxX - laneBox.minX, 0.001, laneBox.maxZ - laneBox.minZ),
  );
  const gatewayGeometry = new BoxGeometry(1.8, 0.9, 1.2);
  const gatewayEdges = new EdgesGeometry(gatewayGeometry);
  const ringGeometry = new TorusGeometry(p.portalRadius, 0.09, 8, 48);
  const discGeometry = new CircleGeometry(p.portalRadius - 0.05, 48);
  const columnGeometry = new BoxGeometry(1.1, 1, 1.1);
  const baseGeometry = new EdgesGeometry(new BoxGeometry(1.3, 0.001, 1.3));
  const dotGeometry = new BoxGeometry(0.24, 0.24, 0.24);

  const lanes = data.lanes.map((lane, index) => {
    const root = new Group();
    scene.add(root);
    const centerX = (laneBox.minX + laneBox.maxX) / 2;
    const centerZ = (laneBox.minZ + laneBox.maxZ) / 2;
    const floorMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.12 });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, centerZ);
    const frameMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
    const frame = new LineSegments(frameGeometry, frameMaterial);
    frame.position.set(centerX, 0, centerZ);

    const gatewayMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.85 });
    const gatewayMesh = new Mesh(gatewayGeometry, gatewayMaterial);
    gatewayMesh.position.set(gateway.x, 0.45, gateway.z);
    const gatewayLineMaterial = new LineBasicMaterial();
    const gatewayLines = new LineSegments(gatewayEdges, gatewayLineMaterial);
    gatewayLines.position.copy(gatewayMesh.position);
    root.add(floor, frame, gatewayMesh, gatewayLines);

    const portals = dimensions.map(({ x }) => {
      const ringMaterial = new MeshBasicMaterial();
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, portalZ);
      const discMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.2 });
      const disc = new Mesh(discGeometry, discMaterial);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.02, portalZ);
      root.add(ring, disc);
      return { ringMaterial, discMaterial, glow: 0.2 };
    });

    const columnMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.8 });
    const column = new Mesh(columnGeometry, columnMaterial);
    column.position.set(lostSpot.x, 0, lostSpot.z);
    const baseMaterial = new LineBasicMaterial();
    const base = new LineSegments(baseGeometry, baseMaterial);
    base.position.set(lostSpot.x, 0.01, lostSpot.z);
    root.add(column, base);

    const dotMaterial = new MeshBasicMaterial();
    const dotMesh = new InstancedMesh(dotGeometry, dotMaterial, p.maxDots);
    dotMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    dotMesh.frustumCulled = false;
    const white = new Color(1, 1, 1);
    for (let i = 0; i < p.maxDots; i += 1) {
      dotMesh.setColorAt(i, white);
    }
    dotMesh.count = 0;
    root.add(dotMesh);
    const dots: Dot[] = [];

    return {
      lane,
      index,
      root,
      floorMaterial,
      frameMaterial,
      gatewayMaterial,
      gatewayLineMaterial,
      portals,
      column,
      columnMaterial,
      baseMaterial,
      dotMesh,
      dotMaterial,
      dots,
      owed: nothingOwed(),
      title: hooks.label(lane.label, 'node'),
      names: dimensions.map(({ name, x }) => ({ x, label: hooks.label(name) })),
      gatewayLabel: hooks.label('gateway'),
    };
  });

  let palette: Palette | null = null;
  let clock = p.startMs;
  let layout = { aspect: 0, top: 0, wide: false };
  const matrix = new Matrix4();
  const spot = new Vector3();
  const scaleVector = new Vector3();

  const eitherHealthy = (): 1 | 2 => (random() < 0.5 ? 1 : 2);

  const portalCenter = (portal: 0 | 1 | 2) => {
    const angle = random() * Math.PI * 2;
    const reach = random() * p.portalRadius * 0.55;
    return new Vector3(
      dimensions[portal].x + Math.cos(angle) * reach,
      0.05,
      portalZ + Math.sin(angle) * reach,
    );
  };

  const spawn = (target: (typeof lanes)[number], fate: Fate) => {
    if (target.dots.length >= p.maxDots) {
      return;
    }
    const portal = fate === 'other' ? eitherHealthy() : 0;
    target.dots.push({
      fate,
      phase: 'fly',
      t: 0,
      duration: p.flight * (0.85 + random() * 0.3),
      from: new Vector3(
        gateway.x + (random() - 0.5) * 1.2,
        gateway.y,
        gateway.z + (random() - 0.5) * 0.6,
      ),
      to: portalCenter(portal),
      arc: 1.8 + random() * 1.2,
      alarm: false,
    });
  };

  const advance = (dot: Dot, dt: number, height: number): boolean => {
    dot.t += dt;
    if (dot.t < dot.duration) {
      return true;
    }
    if (dot.phase === 'fly' && dot.fate === 'failed') {
      dot.phase = 'lost';
      dot.alarm = true;
      dot.t = 0;
      dot.duration = p.hop;
      dot.from = dot.to;
      dot.to = new Vector3(lostSpot.x, height + 0.2, lostSpot.z);
      dot.arc = 1.2;
      return true;
    }
    if (dot.phase === 'fly' && dot.fate === 'retried') {
      dot.phase = 'hop';
      dot.t = 0;
      dot.duration = p.hop;
      dot.from = dot.to;
      dot.to = portalCenter(eitherHealthy());
      dot.arc = 1.4;
      return true;
    }
    if (dot.phase === 'fly' || dot.phase === 'hop') {
      dot.phase = 'enter';
      dot.t = 0;
      dot.duration = 0.2;
      return true;
    }
    return false;
  };

  const restart = () => {
    clock = data.fromMs;
    for (const lane of lanes) {
      lane.dots = [];
      lane.owed = nothingOwed();
    }
  };

  return {
    scene,
    camera,
    setColors(next) {
      palette = next;
      for (const lane of lanes) {
        lane.floorMaterial.color.copy(next.grid);
        lane.frameMaterial.color.copy(next.line);
        lane.gatewayMaterial.color.copy(next.muted);
        lane.gatewayLineMaterial.color.copy(next.fg);
        lane.columnMaterial.color.copy(next.accent);
        lane.baseMaterial.color.copy(next.line);
      }
    },
    step(dt) {
      const speed = speedAt(clock);
      const from = clock;
      clock += dt * 1000 * speed;
      if (clock >= endMs) {
        restart();
        return;
      }
      const perRequest = p.dotsPerSecond / (data.rate * speed);
      for (const lane of lanes) {
        const counts = countsBetween(lane.lane, from, clock);
        for (const fate of fates) {
          lane.owed[fate] += counts[fate] * perRequest;
          while (lane.owed[fate] >= 1) {
            lane.owed[fate] -= 1;
            spawn(lane, fate);
          }
        }
        const height = laneAt(lane.lane, clock).lost / p.lostPerUnit;
        lane.dots = lane.dots.filter((dot) => advance(dot, dt, height));
        lane.dots.forEach((dot, i) => {
          const s = Math.min(1, dot.t / dot.duration);
          if (dot.phase === 'enter') {
            spot.copy(dot.to).setY(dot.to.y - s * 0.6);
            scaleVector.setScalar(Math.max(0.001, 1 - s));
          } else {
            spot.lerpVectors(dot.from, dot.to, s);
            spot.y += dot.arc * 4 * s * (1 - s);
            scaleVector.setScalar(dot.phase === 'lost' ? 1 - s * 0.5 : 1);
          }
          matrix.makeScale(scaleVector.x, scaleVector.y, scaleVector.z).setPosition(spot);
          lane.dotMesh.setMatrixAt(i, matrix);
          if (palette) {
            lane.dotMesh.setColorAt(i, dot.alarm ? palette.accent : palette.signal);
          }
        });
        lane.dotMesh.count = lane.dots.length;
        lane.dotMesh.instanceMatrix.needsUpdate = true;
        if (lane.dotMesh.instanceColor) {
          lane.dotMesh.instanceColor.needsUpdate = true;
        }
        lane.column.visible = height > 0.01;
        lane.column.scale.y = Math.max(0.001, height);
        lane.column.position.y = height / 2;
      }
    },
    render(time, dt = 0.016) {
      const narrow = hooks.size().width < 600;
      const tiny = hooks.size().height < 180;
      const top = narrow ? 0.84 : 0.7;
      if (layout.aspect !== camera.aspect || layout.top !== top) {
        layout = { aspect: camera.aspect, top, wide: layoutIsWide(camera.aspect, top) };
      }
      const { wide } = layout;
      const ease = Math.min(1, dt * 5);
      for (const lane of lanes) {
        const offset = laneOffset(lane.index, wide);
        lane.root.position.set(offset.x, 0, offset.z);
        const { x, z } = lane.root.position;
        const now = laneAt(lane.lane, clock);
        const state = stateOfA(lane.lane, clock);
        const down = clock >= 0 && clock < data.clearMs;
        lane.portals.forEach((portal, index) => {
          const share = index === 0 ? now.toA : (1 - now.toA) / 2;
          portal.glow += (0.06 + share * 0.6 - portal.glow) * ease;
          portal.discMaterial.opacity = portal.glow;
          if (!palette) {
            return;
          }
          const broken = index === 0 && down;
          const out = index === 0 && state === 'out';
          let ringColor = palette.signal;
          if (broken) {
            ringColor = palette.accent;
          } else if (out && !down) {
            ringColor = palette.muted;
          }
          portal.ringMaterial.color.copy(ringColor);
          portal.discMaterial.color.copy(broken ? palette.accent : palette.signal);
        });
        const lost = `${formatNumber(now.lost)} lost`;
        const text = stateText(state, down);
        lane.title.textContent =
          text && !narrow
            ? `${lane.lane.label} · a ${text} · ${lost}`
            : `${lane.lane.label} · ${lost}`;
        const above = !wide && lane.index === 0;
        lane.title.classList.toggle('scene-label-node', !above);
        hooks.place(
          lane.title,
          x + (laneBox.minX + laneBox.maxX) / 2,
          above ? 1.8 : 0,
          z + (above ? laneBox.minZ : laneBox.maxZ),
        );
        for (const name of lane.names) {
          if (wide) {
            hooks.place(name.label, x + name.x, 0.2, z + portalZ - p.portalRadius - 0.2);
          } else {
            hooks.place(name.label, x + name.x - p.portalRadius - 0.45, 0, z + portalZ);
          }
          if (tiny) {
            name.label.style.display = 'none';
          }
        }
        hooks.place(lane.gatewayLabel, x + gateway.x + 2.4, 0.3, z + gateway.z);
        if (narrow) {
          lane.gatewayLabel.style.display = 'none';
        }
      }
      fitCamera(camera, wide, Math.sin(time * 0.05) * p.swing, top);
    },
    readout() {
      const speed = speedAt(clock);
      const seconds = Math.abs(clock / 1000).toFixed(speed < 1 ? 2 : 1);
      const at = `${clock < 0 ? '−' : '+'}${seconds} s`;
      const pace = speed < 1 ? `slowed ${Math.round(1 / speed)}×` : `${speed}× speed`;
      return [
        `${at} · ${phaseOf(clock)} · ${pace}`,
        ...lanes.map(({ lane }) => {
          const now = laneAt(lane, clock);
          const retried = lane.id === 'probes' ? '' : ` · ${now.retried} retried`;
          return `${lane.label}: ${Math.round(now.toA * 100)}% sent to a · ${formatNumber(now.lost)} lost${retried}`;
        }),
      ];
    },
    dispose() {
      for (const lane of lanes) {
        lane.title.remove();
        for (const name of lane.names) {
          name.label.remove();
        }
        lane.gatewayLabel.remove();
        lane.floorMaterial.dispose();
        lane.frameMaterial.dispose();
        lane.gatewayMaterial.dispose();
        lane.gatewayLineMaterial.dispose();
        lane.columnMaterial.dispose();
        lane.baseMaterial.dispose();
        lane.dotMaterial.dispose();
        lane.dotMesh.dispose();
        for (const portal of lane.portals) {
          portal.ringMaterial.dispose();
          portal.discMaterial.dispose();
        }
      }
      for (const geometry of [
        floorGeometry,
        frameGeometry,
        gatewayGeometry,
        gatewayEdges,
        ringGeometry,
        discGeometry,
        columnGeometry,
        baseGeometry,
        dotGeometry,
      ]) {
        geometry.dispose();
      }
    },
  };
};

function phaseOf(clock: number): string {
  if (clock < 0) {
    return `three dimensions, ${formatNumber(data.rate)} requests a second`;
  }
  if (clock < data.clearMs) {
    return 'dimension a refuses every connection';
  }
  return `a is back after ${Math.round(data.clearMs / 1000)} s`;
}

function stateText(state: ReturnType<typeof stateOfA>, down: boolean): string | null {
  if (state === 'picked') {
    return 'down, still picked';
  }
  if (state === 'out') {
    return down ? 'down, taken out' : 'up, still out';
  }
  if (state === 'back') {
    return 'back, slow start';
  }
  return null;
}

function laneOffset(index: number, wide: boolean) {
  const side = index === 0 ? -1 : 1;
  const middle = (laneBox.minX + laneBox.maxX) / 2;
  if (wide) {
    return { x: side * ((laneBox.maxX - laneBox.minX) / 2 + 1) - middle, z: 0 };
  }
  return { x: -middle, z: side * ((laneBox.maxZ - laneBox.minZ) / 2 + 1.1) };
}

const wideTilt = 0.72;
const tallTilt = 1.0;

function corners(wide: boolean): Vector3[] {
  const points: Vector3[] = [];
  for (const index of [0, 1]) {
    const offset = laneOffset(index, wide);
    const captionAbove = !wide && index === 0;
    for (const x of [laneBox.minX, laneBox.maxX]) {
      points.push(
        new Vector3(x + offset.x, captionAbove ? 3.8 : 1.5, laneBox.minZ + offset.z),
        new Vector3(x + offset.x, laneBox.height, laneBox.maxZ + offset.z),
      );
      if (!captionAbove) {
        points.push(new Vector3(x + offset.x, 0, laneBox.maxZ + 2 + offset.z));
      }
    }
  }
  return points;
}

const wideCorners = corners(true);
const tallCorners = corners(false);
const center = new Vector3(0, 1.2, 0);

function margins(top: number) {
  return { top, side: 0.92, bottom: 0.92 };
}

function directionFor(wide: boolean, swing: number): Vector3 {
  return viewFrom(wide ? wideTilt : tallTilt, swing);
}

export function layoutIsWide(aspect: number, top = 0.7): boolean {
  return (
    frame(wideCorners, directionFor(true, 0), aspect, 34, margins(top), center).distance <
    frame(tallCorners, directionFor(false, 0), aspect, 34, margins(top), center).distance * 0.85
  );
}

function fitCamera(camera: PerspectiveCamera, wide: boolean, swing: number, top: number) {
  aim(camera, wide ? wideCorners : tallCorners, directionFor(wide, swing), margins(top), center);
}

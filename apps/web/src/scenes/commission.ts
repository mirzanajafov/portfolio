import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
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
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  type Commission,
  type Seat,
  commissionAt,
  commissionData as data,
  commissionLoop,
  commissionParameters as p,
  families,
  numeral,
  reaches,
} from './commission-model';
import { aim, viewFrom } from './framing';
import type { Palette, SceneFactory } from './types';

const seatRadius = 3;
const outRadius = 4.9;
const tableRadius = 4.2;
const beat = 0.6;
const tilt = 1.02;
const swing = 0.08;

const looks: Record<Seat, { radius: number; lift: number; size: number; word: string }> = {
  up: { radius: seatRadius, lift: 0.45, size: 1, word: '' },
  down: { radius: seatRadius, lift: 0.12, size: 0.5, word: 'killed' },
  frozen: { radius: seatRadius, lift: 0.45, size: 1, word: 'frozen' },
  out: { radius: outRadius, lift: 0.45, size: 0.75, word: 'removed' },
};

const framePoints = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return new Vector3(Math.cos(angle) * (outRadius + 0.4), 0, Math.sin(angle) * (outRadius + 0.4));
}).concat([new Vector3(0, 1.9, -seatRadius), new Vector3(0, 1.2, seatRadius)]);
const center = new Vector3(0, 0.4, 0);

function clock(at: number) {
  return `${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')}`;
}

const number = (value: number) => value.toLocaleString('en-US');

function readoutOf(state: Commission): string[] {
  if (state.finished) {
    return [
      `after the heal: ${number(data.ops)} operations, linearizable`,
      `all five families at state ${data.hash}, entry ${number(data.stateIndex)}`,
      `the ${data.lab.runs} three-minute runs: ${data.lab.faults} faults · ${number(data.lab.ops)} operations · all linearizable`,
    ];
  }
  const reign = state.don
    ? `reign ${state.term}, family ${numeral(state.don)} is the Don`
    : 'no Don, a succession';
  return [
    `${clock(state.at)} of ${clock(data.seconds)} · ${reign}`,
    state.fault?.text ?? 'no fault right now',
    `fault ${state.faults} of ${data.faults.length} · ${state.successions} successions so far`,
  ];
}

function seatText(state: Commission, node: number, narrow: boolean): string {
  if (state.finished) {
    return narrow ? numeral(node) : `${numeral(node)} · ${data.hash}`;
  }
  const seat = state.seat(node);
  let word = looks[seat].word;
  if (seat === 'up' && node === state.don) {
    word = 'Don';
  } else if (seat === 'up' && state.slow.includes(node)) {
    word = 'slow network';
  }
  return word ? `${numeral(node)} · ${word}` : numeral(node);
}

export const createCommissionScene: SceneFactory = (hooks) => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 400);

  const tableGeometry = new CircleGeometry(tableRadius, 64);
  tableGeometry.rotateX(-Math.PI / 2);
  const rimGeometry = new EdgesGeometry(tableGeometry, 1);
  const seatGeometry = new SphereGeometry(0.42, 24, 16);
  const donRingGeometry = new RingGeometry(0.62, 0.72, 48);
  donRingGeometry.rotateX(-Math.PI / 2);
  const pulseGeometry = new SphereGeometry(0.09, 10, 8);

  const tableMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.12 });
  const rimMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
  const linkMaterial = new LineBasicMaterial({ vertexColors: true });
  const donRingMaterial = new MeshBasicMaterial({ side: DoubleSide });
  const pulseMaterial = new MeshBasicMaterial();

  const seats = families.map((_, index) => {
    const node = index + 1;
    const angle = -Math.PI / 2 + (index / families.length) * Math.PI * 2;
    const material = new MeshBasicMaterial();
    return {
      node,
      direction: new Vector3(Math.cos(angle), 0, Math.sin(angle)),
      mesh: new Mesh(seatGeometry, material),
      material,
      label: hooks.label(numeral(node), 'node'),
      radius: seatRadius,
      lift: looks.up.lift,
      size: 1,
    };
  });
  const links = seats.flatMap((a, index) => seats.slice(index + 1).map((b) => ({ a, b })));
  const linkGeometry = new BufferGeometry();
  linkGeometry.setAttribute('position', new Float32BufferAttribute(links.length * 6, 3));
  linkGeometry.setAttribute('color', new Float32BufferAttribute(links.length * 6, 3));

  const donRing = new Mesh(donRingGeometry, donRingMaterial);
  const pulses = new InstancedMesh(pulseGeometry, pulseMaterial, families.length * 2);
  pulses.instanceMatrix.setUsage(DynamicDrawUsage);
  pulses.frustumCulled = false;
  scene.add(
    new Mesh(tableGeometry, tableMaterial),
    new LineSegments(rimGeometry, rimMaterial),
    new LineSegments(linkGeometry, linkMaterial),
    donRing,
    pulses,
    ...seats.map((seat) => seat.mesh),
  );
  const reign = hooks.label('', 'node');

  let palette: Palette | undefined;
  let seconds = commissionLoop - p.holdSeconds - 2;
  let donRingSize = 0;
  let settled = false;
  const donRingAt = new Vector3(0, 0, -seatRadius);
  const colour = new Color();
  const matrix = new Matrix4();
  const spot = new Vector3();

  const linkColour = (state: Commission, a: number, b: number, colours: Palette) => {
    const gone = (node: number) => ['down', 'out'].includes(state.seat(node));
    const ab = reaches(state, a, b);
    const ba = reaches(state, b, a);
    if (gone(a) || gone(b) || (!ab && !ba)) {
      return colours.bg;
    }
    if (!ab || !ba) {
      return colours.line;
    }
    return state.slow.includes(a) || state.slow.includes(b) ? colours.signal : colours.muted;
  };

  const pulse = (from: Vector3, to: Vector3, along: number, size: number) => {
    matrix.makeScale(size, size, size).setPosition(spot.lerpVectors(from, to, along));
    pulses.setMatrixAt(pulses.count, matrix);
    pulses.count += 1;
  };

  return {
    scene,
    camera,
    setColors(next) {
      palette = next;
      tableMaterial.color.copy(next.grid);
      rimMaterial.color.copy(next.line);
      donRingMaterial.color.copy(next.accent);
      pulseMaterial.color.copy(next.accent);
    },
    step(dt) {
      seconds += dt;
      if (seconds >= commissionLoop) {
        seconds -= commissionLoop;
      }
    },
    render(time, dt = 1 / 60) {
      if (!palette) {
        return;
      }
      const narrow = hooks.size().width < 600;
      const state = commissionAt(seconds);
      const follow = settled ? 1 - Math.exp(-dt * 9) : 1;
      settled = true;

      for (const seat of seats) {
        const placed = state.seat(seat.node);
        const look = looks[placed];
        seat.radius += (look.radius - seat.radius) * follow;
        seat.lift += (look.lift - seat.lift) * follow;
        seat.size += (look.size - seat.size) * follow;
        if (placed === 'up') {
          colour.copy(seat.node === state.don ? palette.accent : palette.fg);
        } else {
          colour.copy(placed === 'frozen' ? palette.signal : palette.muted);
        }
        seat.material.color.lerp(colour, follow);
        seat.mesh.position.copy(seat.direction).multiplyScalar(seat.radius).setY(seat.lift);
        seat.mesh.scale.setScalar(seat.size);
        seat.label.textContent = seatText(state, seat.node, narrow);
        hooks.place(seat.label, seat.mesh.position.x, seat.lift - 0.2, seat.mesh.position.z);
      }

      const positions = linkGeometry.getAttribute('position');
      const colours = linkGeometry.getAttribute('color');
      for (const [index, { a, b }] of links.entries()) {
        const shade = linkColour(state, a.node, b.node, palette);
        for (const [end, seat] of [a, b].entries()) {
          const { x, y, z } = seat.mesh.position;
          positions.setXYZ(index * 2 + end, x, y, z);
          colours.setXYZ(index * 2 + end, shade.r, shade.g, shade.b);
        }
      }
      positions.needsUpdate = true;
      colours.needsUpdate = true;

      const don = seats.find((seat) => seat.node === state.don && state.seat(seat.node) === 'up');
      if (don) {
        donRingAt.lerp(don.mesh.position, follow);
      }
      donRingSize += ((don ? 1 : 0) - donRingSize) * follow;
      donRing.position.copy(donRingAt);
      donRing.scale.setScalar(Math.max(0.001, donRingSize));

      pulses.count = 0;
      if (don) {
        const phase = (seconds % beat) / beat;
        for (const seat of seats) {
          const placed = state.seat(seat.node);
          if (seat === don || placed === 'out') {
            continue;
          }
          const delivered = placed !== 'down' && reaches(state, don.node, seat.node);
          if (phase < 0.45) {
            const along = phase / 0.45;
            const size = delivered || along < 0.5 ? 1 : 2 - along * 2;
            pulse(
              don.mesh.position,
              seat.mesh.position,
              delivered ? along : Math.min(along, 0.5),
              size,
            );
          } else if (delivered && placed === 'up' && reaches(state, seat.node, don.node)) {
            pulse(seat.mesh.position, don.mesh.position, Math.min(1, (phase - 0.5) / 0.45), 0.7);
          }
        }
      }
      pulses.instanceMatrix.needsUpdate = true;

      if (state.finished) {
        reign.textContent = 'linearizable';
      } else {
        reign.textContent = state.don ? `reign ${state.term}` : 'no Don';
      }
      hooks.place(reign, 0, 0, tableRadius);

      aim(
        camera,
        framePoints,
        viewFrom(tilt, Math.sin(time * 0.05) * swing),
        { top: narrow ? 0.84 : 0.72, side: 0.92, bottom: 0.92 },
        center,
      );
    },
    readout() {
      return readoutOf(commissionAt(seconds));
    },
    dispose() {
      reign.remove();
      for (const seat of seats) {
        seat.label.remove();
        seat.material.dispose();
      }
      pulses.dispose();
      for (const material of [
        tableMaterial,
        rimMaterial,
        linkMaterial,
        donRingMaterial,
        pulseMaterial,
      ]) {
        material.dispose();
      }
      for (const geometry of [
        tableGeometry,
        rimGeometry,
        seatGeometry,
        donRingGeometry,
        pulseGeometry,
        linkGeometry,
      ]) {
        geometry.dispose();
      }
    },
  };
};

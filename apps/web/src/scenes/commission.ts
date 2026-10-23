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
  type LinkState,
  type Seat,
  commissionAt,
  commissionLoop,
  commissionParameters,
  commissionReplay as replay,
  families,
  numeral,
} from './commission-model';
import { aim, viewFrom } from './framing';
import { formatNumber, plural } from './readout';
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

function readoutOf(state: Commission): string[] {
  if (state.finished) {
    return [
      `after the heal: ${formatNumber(replay.ops)} operations, linearizable`,
      `all five families at state ${replay.hash}, entry ${formatNumber(replay.stateIndex)}`,
      `${replay.lab.runs} three-minute runs: ${replay.lab.faults} faults · ${formatNumber(replay.lab.ops)} operations · ${replay.lab.linearizable} of ${replay.lab.runs} linearizable`,
    ];
  }
  const reign = state.don
    ? `reign ${state.term}, family ${numeral(state.don)} is the Don`
    : 'no Don, a succession';
  return [
    `${clock(state.at)} of ${clock(replay.seconds)} · ${reign}`,
    state.fault?.text ?? 'no fault right now',
    `fault ${state.faultsSoFar} of ${replay.faults.length} · ${plural(state.successions, 'succession', 'successions')} so far`,
  ];
}

function seatText(state: Commission, node: number, narrow: boolean): string {
  if (state.finished) {
    return narrow ? numeral(node) : `${numeral(node)} · ${replay.hash}`;
  }
  const seat = state.seat(node);
  let word = looks[seat].word;
  if (seat === 'up' && node === state.don) {
    word = 'Don';
  } else if (seat === 'up' && state.slow(node)) {
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
  const pulses = new InstancedMesh(pulseGeometry, pulseMaterial, families.length - 1);
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

  let palette: Palette | null = null;
  let seconds = commissionLoop - commissionParameters.holdSeconds - 1;
  let donRingSize = 0;
  let settled = false;
  const donRingAt = new Vector3(0, 0, -seatRadius);
  const color = new Color();
  const matrix = new Matrix4();
  const spot = new Vector3();

  const linkShade = (link: LinkState, shades: Palette) => {
    switch (link) {
      case 'open':
        return shades.muted;
      case 'slow':
        return shades.signal;
      case 'one-way':
        return shades.line;
      case 'cut':
        return shades.bg;
    }
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
          color.copy(seat.node === state.don ? palette.accent : palette.fg);
        } else {
          color.copy(placed === 'frozen' ? palette.signal : palette.muted);
        }
        seat.material.color.lerp(color, follow);
        seat.mesh.position.copy(seat.direction).multiplyScalar(seat.radius).setY(seat.lift);
        seat.mesh.scale.setScalar(seat.size);
        seat.label.textContent = seatText(state, seat.node, narrow);
        hooks.place(seat.label, seat.mesh.position.x, seat.lift - 0.2, seat.mesh.position.z);
      }

      const positions = linkGeometry.getAttribute('position');
      const colors = linkGeometry.getAttribute('color');
      for (const [index, { a, b }] of links.entries()) {
        const shade = linkShade(state.link(a.node, b.node), palette);
        positions.setXYZ(index * 2, a.mesh.position.x, a.mesh.position.y, a.mesh.position.z);
        positions.setXYZ(index * 2 + 1, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
        colors.setXYZ(index * 2, shade.r, shade.g, shade.b);
        colors.setXYZ(index * 2 + 1, shade.r, shade.g, shade.b);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;

      const speaker = seats.find((seat) => seat.node === state.speaker);
      if (speaker) {
        donRingAt.lerp(speaker.mesh.position, follow);
      }
      donRingSize += ((speaker ? 1 : 0) - donRingSize) * follow;
      donRing.position.copy(donRingAt);
      donRing.scale.setScalar(Math.max(0.001, donRingSize));

      pulses.count = 0;
      if (speaker) {
        const phase = (seconds % beat) / beat;
        for (const seat of seats) {
          const heartbeat = state.heartbeat(seat.node);
          if (heartbeat === 'none') {
            continue;
          }
          if (phase < 0.45) {
            const along = phase / 0.45;
            const lost = heartbeat === 'lost';
            const size = !lost || along < 0.5 ? 1 : 2 - along * 2;
            pulse(
              speaker.mesh.position,
              seat.mesh.position,
              lost ? Math.min(along, 0.5) : along,
              size,
            );
          } else if (phase >= 0.5 && heartbeat === 'answered') {
            pulse(
              seat.mesh.position,
              speaker.mesh.position,
              Math.min(1, (phase - 0.5) / 0.45),
              0.7,
            );
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

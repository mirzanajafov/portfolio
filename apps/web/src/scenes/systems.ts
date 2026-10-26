import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { seeded } from './random';
import {
  buildGraph,
  focusPose,
  pullBack,
  type GraphApp,
  type GraphEdge,
  type GraphNode,
} from './systems-graph';
import type { Palette, SceneHooks, SceneInstance } from './types';

type NodeView = {
  node: GraphNode;
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  ring?: Mesh<RingGeometry, MeshBasicMaterial>;
  label: HTMLElement;
};

type Pulse = {
  edge: GraphEdge;
  next?: GraphEdge;
  t: number;
  speed: number;
  mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
};

const sizes = { server: 0.7, app: 0.46, part: 0.17 };
const tones = { server: 'fg', app: 'accent', part: 'muted' } as const;

export const createSystemsScene = (hooks: SceneHooks, apps: GraphApp[]): SceneInstance => {
  const graph = buildGraph(apps);
  const routes = graph.edges
    .filter((edge) => edge.from.kind === 'server')
    .map((edge) => ({ edge, parts: graph.edges.filter((next) => next.from === edge.to) }));
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 500);
  const random = seeded(3);
  const cardsOverStage =
    typeof window === 'undefined' ? null : window.matchMedia('(max-width: 860px)');

  const geometries = {
    server: new SphereGeometry(sizes.server, 28, 20),
    app: new SphereGeometry(sizes.app, 24, 18),
    part: new SphereGeometry(sizes.part, 14, 10),
    ring: new RingGeometry(0.9, 0.97, 48),
    pulse: new SphereGeometry(0.13, 10, 8),
  };

  const views = graph.nodes.map((node): NodeView => {
    const mesh = new Mesh(geometries[node.kind], new MeshBasicMaterial({ transparent: true }));
    mesh.position.set(...node.position);
    scene.add(mesh);
    let ring: NodeView['ring'];
    if (node.kind !== 'part') {
      ring = new Mesh(
        geometries.ring,
        new MeshBasicMaterial({ transparent: true, opacity: 0.55, side: DoubleSide }),
      );
      ring.position.copy(mesh.position);
      ring.scale.setScalar(node.kind === 'server' ? 1.5 : 1);
      scene.add(ring);
    }
    const label = hooks.label(node.label, node.kind === 'part' ? undefined : 'node');
    if (node.kind === 'app') {
      label.classList.add('scene-label-app');
    }
    return { node, mesh, ring, label };
  });

  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      graph.edges.flatMap((edge) => [...edge.from.position, ...edge.to.position]),
      3,
    ),
  );
  const edgeMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.45 });
  scene.add(new LineSegments(edgeGeometry, edgeMaterial));

  const pulses: Pulse[] = [];
  let palette: Palette | null = null;
  let focus: string | null = null;
  let spawnIn = 0;
  const pose = focusPose(graph, null);
  const cameraPosition = new Vector3(...pose.position);
  const cameraTarget = new Vector3(...pose.target);
  const wantedPosition = cameraPosition.clone();
  const wantedTarget = cameraTarget.clone();
  const offset = new Vector3();
  const up = new Vector3(0, 1, 0);
  const start = new Vector3();
  const end = new Vector3();

  const inFocus = (app?: string) => !focus || app === focus;

  function applyFocus() {
    for (const { node, mesh, ring, label } of views) {
      const on = node.kind === 'server' || inFocus(node.app);
      mesh.material.opacity = on ? 1 : 0.15;
      if (ring) {
        ring.material.opacity = on ? 0.55 : 0.08;
      }
      label.classList.toggle('scene-label-dim', !on);
      if (node.kind === 'part') {
        label.dataset.hidden = focus === node.app ? 'false' : 'true';
      }
    }
    edgeMaterial.opacity = focus ? 0.18 : 0.45;
    const next = focusPose(graph, focus);
    wantedPosition.set(...next.position);
    wantedTarget.set(...next.target);
  }

  function spawn() {
    if (!palette) {
      return;
    }
    const route = routes[Math.floor(random() * routes.length)];
    if (!route) {
      return;
    }
    const next = route.parts[Math.floor(random() * route.parts.length)];
    const mesh = new Mesh(
      geometries.pulse,
      new MeshBasicMaterial({ color: palette.accent, transparent: true }),
    );
    scene.add(mesh);
    pulses.push({
      edge: route.edge,
      next,
      t: 0,
      speed: 0.7 + random() * 0.5,
      mesh,
    });
  }

  applyFocus();

  return {
    scene,
    camera,
    focus(id) {
      focus = id;
      applyFocus();
    },
    setColors(next) {
      palette = next;
      for (const { node, mesh, ring } of views) {
        mesh.material.color.copy(next[tones[node.kind]]);
        ring?.material.color.copy(next.muted);
      }
      edgeMaterial.color.copy(next.muted);
      for (const pulse of pulses) {
        pulse.mesh.material.color.copy(next.accent);
      }
    },
    step(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 0.06 + random() * 0.12;
        spawn();
      }
      let kept = 0;
      for (const pulse of pulses) {
        pulse.t += dt * pulse.speed;
        start.fromArray(pulse.edge.from.position);
        end.fromArray(pulse.edge.to.position);
        pulse.mesh.position.lerpVectors(start, end, Math.min(pulse.t, 1));
        pulse.mesh.material.opacity = inFocus(pulse.edge.app) ? 1 : 0.06;
        if (pulse.t >= 1 && pulse.next) {
          pulse.edge = pulse.next;
          pulse.next = undefined;
          pulse.t = 0;
        }
        if (pulse.t < 1) {
          pulses[kept] = pulse;
          kept += 1;
        } else {
          scene.remove(pulse.mesh);
          pulse.mesh.material.dispose();
        }
      }
      pulses.length = kept;
    },
    render(time, dt) {
      const ease = 1 - Math.exp(-(dt ?? 0.016) * 2.6);
      cameraPosition.lerp(wantedPosition, ease);
      cameraTarget.lerp(wantedTarget, ease);
      const covered = cardsOverStage?.matches ?? false;
      const far = pullBack(camera.aspect, focus !== null);
      offset.copy(cameraPosition).sub(cameraTarget);
      if (!focus) {
        offset.applyAxisAngle(up, time * 0.05);
      }
      camera.position.copy(cameraTarget).addScaledVector(offset, far);
      camera.lookAt(cameraTarget);
      const { width, height } = hooks.size();
      if (covered && width > 0 && height > 0) {
        camera.setViewOffset(width, height, 0, height * 0.16, width, height);
      } else {
        camera.clearViewOffset();
      }
      for (const { node, mesh, ring, label } of views) {
        ring?.lookAt(camera.position);
        hooks.place(label, mesh.position.x, mesh.position.y, mesh.position.z);
        if (node.kind === 'part' && label.dataset.hidden === 'true') {
          label.style.display = 'none';
        }
      }
    },
    readout() {
      const focused = focus ? graph.apps.find((app) => app.id === focus)?.name : null;
      return [focused ? `following ${focused}` : `${graph.apps.length} apps on one server`];
    },
    dispose() {
      for (const { label } of views) {
        label.remove();
      }
      for (const pulse of pulses) {
        pulse.mesh.material.dispose();
      }
      for (const geometry of Object.values(geometries)) {
        geometry.dispose();
      }
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    },
  };
};

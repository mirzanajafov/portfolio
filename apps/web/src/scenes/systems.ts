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
import { buildGraph, focusPose, type GraphApp, type GraphNode } from './systems-graph';
import type { Palette, SceneFactory } from './types';

type NodeView = { node: GraphNode; mesh: Mesh; ring?: Mesh; label: HTMLElement };
type Pulse = {
  app: string;
  from: string;
  to: string;
  t: number;
  speed: number;
  mesh: Mesh;
  then?: string;
};

const sizes = { server: 0.7, app: 0.46, part: 0.17 };

export const createSystemsScene: SceneFactory = (hooks, data) => {
  const apps = Array.isArray(data) && data.length > 0 ? (data as GraphApp[]) : [];
  const graph = buildGraph(apps);
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 500);
  const random = seeded(3);

  const geometries = {
    server: new SphereGeometry(sizes.server, 28, 20),
    app: new SphereGeometry(sizes.app, 24, 18),
    part: new SphereGeometry(sizes.part, 14, 10),
    ring: new RingGeometry(0.9, 0.97, 48),
    pulse: new SphereGeometry(0.13, 10, 8),
  };

  const views = new Map<string, NodeView>();
  for (const node of graph.nodes) {
    const mesh = new Mesh(geometries[node.kind], new MeshBasicMaterial({ transparent: true }));
    mesh.position.set(...node.position);
    scene.add(mesh);
    let ring: Mesh | undefined;
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
    if (node.kind === 'app') label.classList.add('scene-label-app');
    views.set(node.id, { node, mesh, ring, label });
  }

  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      graph.edges.flatMap((edge) => [
        ...views.get(edge.from)!.node.position,
        ...views.get(edge.to)!.node.position,
      ]),
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

  const inFocus = (app?: string) => !focus || app === focus;

  function applyFocus() {
    for (const { node, mesh, ring, label } of views.values()) {
      const on = node.kind === 'server' || inFocus(node.app);
      (mesh.material as MeshBasicMaterial).opacity = on ? 1 : 0.15;
      if (ring) (ring.material as MeshBasicMaterial).opacity = on ? 0.55 : 0.08;
      label.classList.toggle('scene-label-dim', !on);
      if (node.kind === 'part') label.dataset.hidden = focus === node.app ? 'false' : 'true';
    }
    edgeMaterial.opacity = focus ? 0.18 : 0.45;
    const next = focusPose(graph, focus);
    wantedPosition.set(...next.position);
    wantedTarget.set(...next.target);
  }

  function spawn() {
    if (!palette) return;
    const app = apps[Math.floor(random() * apps.length)]!;
    const parts = graph.edges.filter((edge) => edge.from === app.id);
    const part = parts[Math.floor(random() * parts.length)]?.to;
    const mesh = new Mesh(
      geometries.pulse,
      new MeshBasicMaterial({ color: palette.accent, transparent: true }),
    );
    scene.add(mesh);
    pulses.push({
      app: app.id,
      from: 'server',
      to: app.id,
      t: 0,
      speed: 0.7 + random() * 0.5,
      mesh,
      then: part,
    });
  }

  applyFocus();

  return {
    scene,
    camera,
    legend: [],
    focus(id) {
      focus = id;
      applyFocus();
    },
    setColors(next) {
      palette = next;
      for (const { node, mesh, ring } of views.values()) {
        const tone =
          node.kind === 'server' ? next.fg : node.kind === 'app' ? next.accent : next.muted;
        (mesh.material as MeshBasicMaterial).color.copy(tone);
        if (ring) (ring.material as MeshBasicMaterial).color.copy(next.muted);
      }
      edgeMaterial.color.copy(next.muted);
      for (const pulse of pulses)
        (pulse.mesh.material as MeshBasicMaterial).color.copy(next.accent);
    },
    step(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 0.06 + random() * 0.12;
        spawn();
      }
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const pulse = pulses[i]!;
        pulse.t += dt * pulse.speed;
        pulse.mesh.position.lerpVectors(
          views.get(pulse.from)!.mesh.position,
          views.get(pulse.to)!.mesh.position,
          Math.min(pulse.t, 1),
        );
        (pulse.mesh.material as MeshBasicMaterial).opacity = inFocus(pulse.app) ? 1 : 0.06;
        if (pulse.t >= 1) {
          if (pulse.then) {
            pulse.from = pulse.to;
            pulse.to = pulse.then;
            pulse.then = undefined;
            pulse.t = 0;
          } else {
            scene.remove(pulse.mesh);
            (pulse.mesh.material as MeshBasicMaterial).dispose();
            pulses.splice(i, 1);
          }
        }
      }
    },
    render(time, dt) {
      const ease = 1 - Math.exp(-(dt ?? 0.016) * 2.6);
      cameraPosition.lerp(wantedPosition, ease);
      cameraTarget.lerp(wantedTarget, ease);
      const portrait = camera.aspect < 0.9;
      const far = Math.max(1, (focus ? 0.9 : 1.2) / camera.aspect);
      offset.copy(cameraPosition).sub(cameraTarget);
      if (!focus) offset.applyAxisAngle(up, time * 0.05);
      camera.position.copy(cameraTarget).addScaledVector(offset, far);
      camera.lookAt(cameraTarget);
      const { width, height } = hooks.size();
      if (portrait && width > 0 && height > 0) {
        camera.setViewOffset(width, height, 0, height * 0.16, width, height);
      } else {
        camera.clearViewOffset();
      }
      for (const { node, mesh, ring, label } of views.values()) {
        if (ring) ring.lookAt(camera.position);
        hooks.place(label, mesh.position.x, mesh.position.y, mesh.position.z);
        if (node.kind === 'part' && label.dataset.hidden === 'true') label.style.display = 'none';
      }
    },
    readout() {
      const focused = focus ? graph.apps.find((app) => app.id === focus)?.name : null;
      return [focused ? `following ${focused}` : `${graph.apps.length} apps on one server`];
    },
    dispose() {
      for (const { label } of views.values()) label.remove();
      for (const pulse of pulses) (pulse.mesh.material as MeshBasicMaterial).dispose();
      for (const geometry of Object.values(geometries)) geometry.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    },
  };
};

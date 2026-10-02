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
import { graphNodes, graphRoutes, routeTouches, uniqueEdges, type NodeId } from './systems-graph';
import type { Palette, SceneFactory } from './types';

type Pulse = { route: string; from: NodeId; to: NodeId; t: number; speed: number; mesh: Mesh };

export const createSystemsScene: SceneFactory = (hooks) => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 500);
  const random = seeded(3);
  const nodeIds = Object.keys(graphNodes) as NodeId[];
  const position = (id: NodeId) => new Vector3(...graphNodes[id].position);

  const nodeGeometry = new SphereGeometry(0.34, 24, 18);
  const ringGeometry = new RingGeometry(0.85, 0.92, 48);
  type NodeView = { mesh: Mesh; ring: Mesh; label: HTMLElement };
  const nodes = {} as Record<NodeId, NodeView>;
  for (const id of nodeIds) {
    const mesh: Mesh = new Mesh(nodeGeometry, new MeshBasicMaterial({ transparent: true }));
    mesh.position.copy(position(id));
    const ring: Mesh = new Mesh(
      ringGeometry,
      new MeshBasicMaterial({ transparent: true, opacity: 0.6, side: DoubleSide }),
    );
    ring.position.copy(mesh.position);
    scene.add(mesh, ring);
    nodes[id] = { mesh, ring, label: hooks.label(graphNodes[id].label, 'node') };
  }

  const edges = uniqueEdges();
  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      edges.flatMap(([a, b]) => [...graphNodes[a].position, ...graphNodes[b].position]),
      3,
    ),
  );
  const edgeMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.5 });
  scene.add(new LineSegments(edgeGeometry, edgeMaterial));

  const pulseGeometry = new SphereGeometry(0.17, 12, 10);
  const pulses: Pulse[] = [];
  const spawnIn = Object.fromEntries(Object.keys(graphRoutes).map((id) => [id, random()]));
  let palette: Palette | null = null;
  let focus: string | null = null;
  let delivered = 0;

  function applyFocus() {
    for (const id of nodeIds) {
      const on = routeTouches(focus, id);
      const node = nodes[id];
      (node.mesh.material as MeshBasicMaterial).opacity = on ? 1 : 0.18;
      (node.ring.material as MeshBasicMaterial).opacity = on ? 0.6 : 0.08;
      node.label.classList.toggle('scene-label-dim', !on);
    }
    edgeMaterial.opacity = focus ? 0.16 : 0.5;
  }

  function spawn(routeId: string) {
    const route = graphRoutes[routeId];
    if (!route || !palette) {
      return;
    }
    const [from, to] = route.path[Math.floor(random() * route.path.length)] ?? route.path[0]!;
    const mesh = new Mesh(
      pulseGeometry,
      new MeshBasicMaterial({ color: palette[route.tone], transparent: true }),
    );
    scene.add(mesh);
    pulses.push({ route: routeId, from, to, t: 0, speed: 0.6 + random() * 0.5, mesh });
  }

  return {
    scene,
    camera,
    legend: Object.entries(graphRoutes).map(([id, route]) => ({ id, label: route.label })),
    focus(id) {
      focus = id;
      applyFocus();
    },
    setColors(next) {
      palette = next;
      for (const { mesh, ring } of Object.values(nodes)) {
        (mesh.material as MeshBasicMaterial).color.copy(next.accent);
        (ring.material as MeshBasicMaterial).color.copy(next.muted);
      }
      edgeMaterial.color.copy(next.muted);
      for (const pulse of pulses) {
        const tone = graphRoutes[pulse.route]?.tone ?? 'fg';
        (pulse.mesh.material as MeshBasicMaterial).color.copy(next[tone]);
      }
      applyFocus();
    },
    step(dt) {
      for (const id of Object.keys(spawnIn)) {
        spawnIn[id] = (spawnIn[id] ?? 0) - dt;
        if ((spawnIn[id] ?? 0) <= 0) {
          spawnIn[id] = 0.12 + random() * 0.25;
          spawn(id);
        }
      }
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const pulse = pulses[i]!;
        pulse.t += dt * pulse.speed;
        pulse.mesh.position.lerpVectors(
          nodes[pulse.from].mesh.position,
          nodes[pulse.to].mesh.position,
          Math.min(pulse.t, 1),
        );
        const on = !focus || focus === pulse.route;
        (pulse.mesh.material as MeshBasicMaterial).opacity = on
          ? 1 - Math.max(0, pulse.t - 0.85) * 6
          : 0.05;
        if (pulse.t >= 1) {
          delivered += 1;
          scene.remove(pulse.mesh);
          (pulse.mesh.material as MeshBasicMaterial).dispose();
          pulses.splice(i, 1);
        }
      }
    },
    render(time) {
      const portrait = camera.aspect < 0.9;
      if (portrait) {
        const pan = Math.sin(time * 0.09) * 4.5;
        camera.position.set(pan, -1, 48);
        camera.lookAt(pan, -3.6, 0);
      } else {
        const swing = Math.sin(time * 0.07) * 0.5;
        const far = Math.max(1, 1.6 / camera.aspect);
        camera.position.set(Math.sin(swing) * 34 * far, 4, Math.cos(swing) * 34 * far);
        camera.lookAt(-0.5, -2.5 - 3 * (far - 1), 0);
      }
      for (const { mesh, ring, label } of Object.values(nodes)) {
        ring.lookAt(camera.position);
        hooks.place(label, mesh.position.x, mesh.position.y, mesh.position.z);
      }
    },
    readout() {
      const shown = focus ? (graphRoutes[focus]?.label ?? focus) : 'all four systems';
      return [
        `What runs on my server · ${shown}`,
        `${nodeIds.length} components · ${edges.length} connections · ${delivered} requests drawn`,
      ];
    },
    dispose() {
      for (const { label } of Object.values(nodes)) {
        label.remove();
      }
      for (const pulse of pulses) {
        (pulse.mesh.material as MeshBasicMaterial).dispose();
      }
      nodeGeometry.dispose();
      ringGeometry.dispose();
      pulseGeometry.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    },
  };
};

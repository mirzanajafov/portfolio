export type GraphApp = { id: string; name: string; stack: string[] };

export type GraphNode = {
  id: string;
  kind: 'server' | 'app' | 'part';
  label: string;
  app?: string;
  position: [number, number, number];
};

export type GraphEdge = { from: string; to: string; app: string };

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[]; apps: GraphApp[] };

const ringRadius = 12;
const partRadius = 3.6;

function partId(app: string, part: string): string {
  return `${app}:${part.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function buildGraph(apps: GraphApp[]): Graph {
  const nodes: GraphNode[] = [
    { id: 'server', kind: 'server', label: 'my server', position: [0, 0, 0] },
  ];
  const edges: GraphEdge[] = [];
  apps.forEach((app, index) => {
    const angle = (index / apps.length) * Math.PI * 2 - Math.PI / 2;
    const ax = Math.cos(angle) * ringRadius;
    const az = Math.sin(angle) * ringRadius;
    const ay = index % 2 === 0 ? 0.8 : -0.8;
    nodes.push({ id: app.id, kind: 'app', label: app.name, app: app.id, position: [ax, ay, az] });
    edges.push({ from: 'server', to: app.id, app: app.id });
    const parts = [...new Set(app.stack)];
    parts.forEach((part, partIndex) => {
      const spread = parts.length === 1 ? 0 : (partIndex / (parts.length - 1) - 0.5) * 2.4;
      const partAngle = angle + spread;
      const id = partId(app.id, part);
      nodes.push({
        id,
        kind: 'part',
        label: part,
        app: app.id,
        position: [
          ax + Math.cos(partAngle) * partRadius,
          ay + (partIndex % 3) - 1,
          az + Math.sin(partAngle) * partRadius,
        ],
      });
      edges.push({ from: app.id, to: id, app: app.id });
    });
  });
  return { nodes, edges, apps };
}

export function focusPose(
  graph: Graph,
  focus: string | null,
): { position: [number, number, number]; target: [number, number, number] } {
  const app = focus ? graph.nodes.find((node) => node.kind === 'app' && node.id === focus) : null;
  if (!app) {
    return { position: [0, 26, 34], target: [0, -1, 0] };
  }
  const [x, y, z] = app.position;
  const length = Math.hypot(x, z) || 1;
  const out: [number, number] = [x / length, z / length];
  const side: [number, number] = [-out[1], out[0]];
  const target: [number, number, number] = [x + out[0] * 1.6, y - 0.3, z + out[1] * 1.6];
  return {
    position: [target[0] + side[0] * 7.5, target[1] + 12, target[2] + side[1] * 7.5],
    target,
  };
}

export function pullBack(aspect: number, focused: boolean): number {
  return focused ? Math.max(1.2, 0.8 / aspect) : Math.max(1, 1.2 / aspect);
}

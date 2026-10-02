export type NodeId =
  | 'browser'
  | 'desktop'
  | 'receivers'
  | 'edge'
  | 'next'
  | 'nest'
  | 'mqtt'
  | 'postgres'
  | 'redis'
  | 'timescale'
  | 'python';

export type Tone = 'accent' | 'fg' | 'signal' | 'muted';

export const graphNodes: Record<NodeId, { position: [number, number, number]; label: string }> = {
  browser: { position: [-14, 2, 0], label: 'browser' },
  desktop: { position: [-14, 6, -3], label: 'Electron app' },
  receivers: { position: [-14, -2, 3], label: 'ESP32 receivers' },
  edge: { position: [-7.5, 2, 0], label: 'Caddy edge' },
  next: { position: [-2, 5, 0], label: 'Next.js' },
  nest: { position: [4, 2, 0], label: 'NestJS' },
  mqtt: { position: [-6, -2.5, 3], label: 'MQTT' },
  postgres: { position: [11, 5, -1], label: 'PostgreSQL' },
  redis: { position: [10, -1, 3], label: 'Redis' },
  timescale: { position: [13, -3, -1], label: 'TimescaleDB' },
  python: { position: [12, 9, 2], label: 'Python engine' },
};

export const graphRoutes: Record<string, { label: string; tone: Tone; path: [NodeId, NodeId][] }> =
  {
    site: {
      label: 'this site',
      tone: 'accent',
      path: [
        ['browser', 'edge'],
        ['edge', 'next'],
        ['next', 'nest'],
        ['nest', 'postgres'],
      ],
    },
    matchium: {
      label: 'Matchium',
      tone: 'fg',
      path: [
        ['browser', 'edge'],
        ['edge', 'next'],
        ['next', 'nest'],
        ['nest', 'postgres'],
        ['python', 'postgres'],
      ],
    },
    marauder: {
      label: 'Marauder',
      tone: 'signal',
      path: [
        ['receivers', 'mqtt'],
        ['mqtt', 'nest'],
        ['nest', 'redis'],
        ['nest', 'timescale'],
        ['nest', 'edge'],
        ['edge', 'browser'],
      ],
    },
    'tm-post': {
      label: 'TM Post',
      tone: 'muted',
      path: [
        ['desktop', 'edge'],
        ['edge', 'nest'],
        ['nest', 'postgres'],
      ],
    },
  };

export function uniqueEdges(): [NodeId, NodeId][] {
  const seen = new Set<string>();
  const edges: [NodeId, NodeId][] = [];
  for (const route of Object.values(graphRoutes)) {
    for (const [a, b] of route.path) {
      const key = [a, b].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }
  return edges;
}

export function routeTouches(routeId: string | null, node: NodeId): boolean {
  if (!routeId) {
    return true;
  }
  return graphRoutes[routeId]?.path.some(([a, b]) => a === node || b === node) ?? false;
}

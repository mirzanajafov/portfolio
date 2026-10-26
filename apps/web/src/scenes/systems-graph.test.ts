import { content } from '@portfolio/content';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildGraph, focusPose, pullBack } from './systems-graph';

const apps = content.projects.map((project) => ({
  id: project.slug,
  name: project.name,
  stack: project.stack,
}));
const graph = buildGraph(apps);

describe('the systems graph', () => {
  it('puts every project from the content on the map, this site included', () => {
    const appNodes = graph.nodes.filter((node) => node.kind === 'app').map((node) => node.label);
    expect(appNodes).toEqual(content.projects.map((p) => p.name));
    expect(appNodes).toContain('najafov.dev');
  });

  it('draws each project’s own stack around it, since each app runs its own containers', () => {
    const matchium = content.projects.find((p) => p.slug === 'matchium');
    const parts = graph.nodes.filter((node) => node.kind === 'part' && node.app === 'matchium');
    expect(parts.map((node) => node.label)).toEqual(matchium?.stack);
  });

  it('connects the server to every app and every app to its parts, and nothing else', () => {
    const ids = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.from.id) && ids.has(edge.to.id)).toBe(true);
    }
    expect(graph.edges.filter((edge) => edge.from.kind === 'server')).toHaveLength(apps.length);
  });

  it('moves the camera close to an app when it is in focus and back out otherwise', () => {
    const overview = focusPose(graph, null);
    const close = focusPose(graph, 'marauder');
    const marauder = graph.nodes.find((node) => node.id === 'marauder');
    const distance = (a: number[], b: number[]) =>
      Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    expect(distance(close.position, marauder!.position)).toBeLessThan(
      distance(overview.position, marauder!.position),
    );
    expect(focusPose(graph, 'no-such-app')).toEqual(overview);
  });

  it('spreads each close-up so no two labels land on each other, even on a phone', () => {
    const [width, height] = [390, 844];
    for (const app of apps) {
      const pose = focusPose(graph, app.id);
      const camera = new PerspectiveCamera(36, width / height, 0.1, 500);
      const target = new Vector3(...pose.target);
      const offset = new Vector3(...pose.position).sub(target);
      camera.position.copy(target).addScaledVector(offset, pullBack(camera.aspect, true));
      camera.lookAt(target);
      camera.setViewOffset(width, height, 0, height * 0.16, width, height);
      camera.updateMatrixWorld();
      const boxes = graph.nodes
        .filter((node) => node.app === app.id)
        .map((node) => {
          const point = new Vector3(...node.position).project(camera);
          const x = ((point.x + 1) / 2) * width;
          const y = ((1 - point.y) / 2) * height;
          const app = node.kind === 'app';
          const w = node.label.length * (app ? 7.2 : 6.6) + 12;
          const h = app ? 20 : 19;
          const top = app ? y + 0.7 * h : y - 1.4 * h;
          return { label: node.label, left: x - w / 2, right: x + w / 2, top, bottom: top + h };
        });
      const touching = boxes.flatMap((a, i) =>
        boxes
          .slice(i + 1)
          .filter(
            (b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom,
          )
          .map((b) => `${a.label}/${b.label}`),
      );
      expect(touching, app.name).toEqual([]);
    }
  });
});

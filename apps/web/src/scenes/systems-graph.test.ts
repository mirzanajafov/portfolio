import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import { buildGraph, focusPose } from './systems-graph';

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
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
    }
    expect(graph.edges.filter((edge) => edge.from === 'server')).toHaveLength(apps.length);
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
});

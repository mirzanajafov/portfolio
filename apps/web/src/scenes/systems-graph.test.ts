import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import { graphNodes, graphRoutes, routeTouches, uniqueEdges } from './systems-graph';

describe('the systems graph', () => {
  it('only connects nodes that exist', () => {
    for (const route of Object.values(graphRoutes)) {
      for (const [a, b] of route.path) {
        expect(graphNodes[a]).toBeDefined();
        expect(graphNodes[b]).toBeDefined();
      }
    }
  });

  it('draws each connection once even when several projects share it', () => {
    const keys = uniqueEdges().map(([a, b]) => [a, b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('browser|edge');
  });

  it('names only projects that exist in the content, plus this site', () => {
    const slugs = new Set(content.projects.map((project) => project.slug));
    for (const id of Object.keys(graphRoutes)) {
      expect(id === 'site' || slugs.has(id)).toBe(true);
    }
  });

  it('follows one project when asked and everything otherwise', () => {
    expect(routeTouches('marauder', 'mqtt')).toBe(true);
    expect(routeTouches('marauder', 'python')).toBe(false);
    expect(routeTouches(null, 'python')).toBe(true);
  });
});

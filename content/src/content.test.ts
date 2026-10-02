import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = await loadContent(root);

describe('the real content', () => {
  it('has projects', () => {
    expect(content.projects.length).toBeGreaterThan(0);
  });

  it.each(content.projects.map((p) => [p.slug, p] as const))(
    '%s is complete enough for a card and for the eval set',
    (_slug, project) => {
      const headline = project.facts.find((fact) => fact.id === project.headline);
      expect(headline).toBeDefined();
      expect(project.evals.length).toBeGreaterThanOrEqual(3);
      const asked = new Set(project.evals.flatMap((question) => question.expects));
      expect(asked.has(project.headline)).toBe(true);
      if (project.visibility === 'private') {
        expect(project.links.repo).toBeUndefined();
        expect(project.knowledge).toEqual([]);
      } else {
        expect(project.knowledge).toContain('README.md');
      }
    },
  );

  it('lists every role newest first', () => {
    const starts = content.cv.experience.map((role) => role.from);
    expect(starts).toEqual([...starts].sort().reverse());
  });
});

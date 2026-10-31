import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from './load.ts';
import { phoneNumber } from './testing.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = await loadContent(root);

function sectionsOf(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

describe('the real content', () => {
  it('has projects', () => {
    expect(content.projects.length).toBeGreaterThan(0);
  });

  it.each(content.projects.map((p) => [p.slug, p] as const))(
    '%s is complete enough for a card and for the eval set',
    (_slug, project) => {
      expect(project.evals.length).toBeGreaterThanOrEqual(3);
      const asked = new Set(project.evals.flatMap((question) => question.expects));
      expect(asked.has(project.headline.id)).toBe(true);
      if (project.visibility === 'private') {
        expect(project.links.repo).toBeUndefined();
        expect(project.knowledge).toEqual([]);
      } else {
        expect(project.knowledge).toContain('README.md');
      }
    },
  );

  it('cites a file and a section that exist in this repo for every fact about this site', () => {
    const facts = content.projects.find((project) => project.slug === 'najafov-dev')?.facts ?? [];
    expect(facts.length).toBeGreaterThan(0);
    const broken = facts
      .map(({ source }) => source)
      .filter(({ file, section }) => {
        const path = join(root, '..', file);
        return !existsSync(path) || (section !== undefined && !sectionsOf(path).includes(section));
      });
    expect(broken).toEqual([]);
  });

  it('publishes no phone number anywhere', () => {
    expect(JSON.stringify(content)).not.toMatch(phoneNumber);
  });

  it('lists every role newest first', () => {
    const starts = content.cv.experience.map((role) => role.from);
    expect(starts).toEqual([...starts].sort().reverse());
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentError, loadContent } from './load.ts';
import { renderGenerated } from './generate.ts';

const validProfile = `
name: Test Person
alternateNames: [Test Persson]
headline: Senior Backend Engineer
location: Baku, Azerbaijan
timezone: UTC+4
availability: Open to remote roles
summary: I build backends.
links:
  email: test@example.com
  github: https://github.com/test
  linkedin: https://www.linkedin.com/in/test
`;

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'content-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function issuesFor(profile: string | null) {
  if (profile !== null) {
    await writeFile(join(root, 'profile.yaml'), profile, 'utf8');
  }
  try {
    await loadContent(root);
  } catch (error) {
    if (error instanceof ContentError) {
      return error.issues;
    }
    throw error;
  }
  return [];
}

describe('loadContent', () => {
  it('loads a valid profile', async () => {
    await writeFile(join(root, 'profile.yaml'), validProfile, 'utf8');
    const content = await loadContent(root);
    expect(content.profile.name).toBe('Test Person');
    expect(content.profile.alternateNames).toEqual(['Test Persson']);
  });

  it('defaults alternate names to an empty list', async () => {
    await writeFile(
      join(root, 'profile.yaml'),
      validProfile.replace('alternateNames: [Test Persson]\n', ''),
      'utf8',
    );
    const content = await loadContent(root);
    expect(content.profile.alternateNames).toEqual([]);
  });

  it('reports a missing file', async () => {
    expect(await issuesFor(null)).toEqual([
      { file: 'profile.yaml', path: '', message: 'file is missing' },
    ]);
  });

  it('reports broken YAML with the file name', async () => {
    const issues = await issuesFor('name: [unclosed');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/^not valid YAML/);
  });

  it('reports every invalid field with its path', async () => {
    const issues = await issuesFor(
      validProfile
        .replace('test@example.com', 'not-an-email')
        .replace('UTC+4', 'Baku time')
        .concat('phone: "+994 00 000 00 00"\n'),
    );
    const paths = issues.map((issue) => issue.path).sort();
    expect(paths).toEqual(['(root)', 'links.email', 'timezone']);
  });
});

describe('renderGenerated', () => {
  it('writes a typed module that holds the validated content', async () => {
    await writeFile(join(root, 'profile.yaml'), validProfile, 'utf8');
    const source = renderGenerated(await loadContent(root));
    expect(source).toContain("import type { Content } from '../schema.ts';");
    expect(source).toContain('export const content: Content = {');
    expect(source).toContain('"name": "Test Person"');
  });
});

import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentError, loadContent } from './load.ts';
import { scaffoldProject } from './scaffold.ts';

const realRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'scaffold-'));
  await cp(join(realRoot, 'profile.yaml'), join(root, 'profile.yaml'));
  await cp(join(realRoot, 'cv.yaml'), join(root, 'cv.yaml'));
  await cp(join(realRoot, 'projects'), join(root, 'projects'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('scaffoldProject', () => {
  it('creates a project folder that fails the checks until every required field is filled', async () => {
    await scaffoldProject(root, 'new-thing');
    expect((await readdir(join(root, 'projects', 'new-thing'))).sort()).toEqual([
      'evals.yaml',
      'project.yaml',
    ]);
    const error = await loadContent(root).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    const problems = (error as ContentError).issues.filter((i) => i.file.includes('new-thing'));
    const paths = new Set(problems.map((i) => `${i.file.split('/').pop()} ${i.path}`));
    for (const expected of [
      'project.yaml name',
      'project.yaml order',
      'project.yaml hook',
      'project.yaml links.live',
      'project.yaml stack',
      'project.yaml headline',
      'project.yaml facts',
      'evals.yaml (root)',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('refuses a name that is not a slug', async () => {
    await expect(scaffoldProject(root, 'New Thing')).rejects.toThrow(/is not a slug/);
  });

  it('never overwrites an existing project', async () => {
    await expect(scaffoldProject(root, 'matchium')).rejects.toThrow(/already exists/);
  });
});

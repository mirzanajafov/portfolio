import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { ContentError, loadContent, type ContentIssue } from './load.ts';
import { renderGenerated } from './generate.ts';

const profile = {
  name: 'Test Person',
  alternateNames: ['Test Persson'],
  headline: 'Senior Backend Engineer',
  location: 'Baku, Azerbaijan',
  timezone: 'UTC+4',
  availability: 'Open to remote roles',
  summary: 'I build backends.',
  links: {
    email: 'test@example.com',
    github: 'https://github.com/test',
    linkedin: 'https://www.linkedin.com/in/test',
  },
};

const role = (company: string, from: string, to: string) => ({
  company,
  role: 'Backend Engineer',
  kind: 'employee',
  from,
  to,
  location: 'Remote',
  remote: true,
  highlights: ['Built things.'],
});

const cv = {
  experience: [role('Older', '2020-01', '2022-12'), role('Newer', '2023-01', 'present')],
  skills: [{ group: 'Backend', items: ['Node.js'] }],
  languages: [{ name: 'English', level: 'Professional' }],
};

const project = (order: number, overrides: Record<string, unknown> = {}) => ({
  name: `Project ${order}`,
  order,
  hook: 'A hook',
  summary: 'A summary.',
  visibility: 'public',
  links: { live: 'https://example.com', repo: 'https://github.com/test/project' },
  stack: ['NestJS'],
  headline: 'fast',
  facts: [
    { id: 'fast', text: 'It is fast.', kind: 'measured', source: { file: 'README.md' } },
    { id: 'small', text: 'It is small.', kind: 'design', source: { file: 'README.md' } },
  ],
  knowledge: ['README.md'],
  ...overrides,
});

const evals = [
  { question: 'Is it fast?', expects: ['fast'] },
  { question: 'Is it small?', expects: ['small'] },
  { question: 'Is it both?', expects: ['fast', 'small'] },
];

const caseStudy = {
  problem: 'It was slow.',
  demo: 'floor',
  demoCaption: 'Dots on a floor plan.',
  decisions: [
    { title: 'Make it fast', body: 'I made it fast.', facts: ['fast'] },
    { title: 'Keep it small', body: 'I kept it small.', facts: ['small'] },
  ],
  proof: 'Tests.',
  next: 'More tests.',
};

let root: string;

async function put(file: string, value: unknown): Promise<void> {
  const path = join(root, file);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, typeof value === 'string' ? value : stringify(value), 'utf8');
}

async function putProject(slug: string, value: unknown, questions: unknown = evals) {
  await put(`projects/${slug}/project.yaml`, value);
  await put(`projects/${slug}/evals.yaml`, questions);
}

async function issues(): Promise<ContentIssue[]> {
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

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'content-'));
  await put('profile.yaml', profile);
  await put('cv.yaml', cv);
  await putProject('alpha', project(2));
  await putProject('beta', project(1));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('loadContent', () => {
  it('loads valid content with projects in their order and the newest role first', async () => {
    const content = await loadContent(root);
    expect(content.profile.name).toBe('Test Person');
    expect(content.projects.map((p) => p.slug)).toEqual(['beta', 'alpha']);
    expect(content.cv.experience.map((r) => r.company)).toEqual(['Newer', 'Older']);
    expect(content.cv.mentoring).toEqual([]);
  });

  it('notices a case study when the file is there', async () => {
    await put('projects/alpha/case-study.yaml', caseStudy);
    const content = await loadContent(root);
    expect(content.projects.find((p) => p.slug === 'alpha')?.caseStudy?.demo).toBe('floor');
    expect(content.projects.find((p) => p.slug === 'beta')?.caseStudy).toBeUndefined();
  });

  it('backs every number in a case study with a fact of the same project', async () => {
    await put('projects/alpha/case-study.yaml', {
      ...caseStudy,
      decisions: [...caseStudy.decisions, { title: 'Brag', body: 'It won.', facts: ['award'] }],
    });
    expect(await issues()).toEqual([
      {
        file: 'projects/alpha/case-study.yaml',
        path: 'decisions.2.facts.0',
        message: '"award" is not a fact of this project',
      },
    ]);
  });

  it('wants a caption for every demo, so nothing moves on the page without an explanation', async () => {
    const { demoCaption: _, ...withoutCaption } = caseStudy;
    await put('projects/alpha/case-study.yaml', withoutCaption);
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'projects/alpha/case-study.yaml', path: 'demoCaption' }),
    ]);
  });

  it('only accepts demos the site knows how to draw', async () => {
    await put('projects/alpha/case-study.yaml', { ...caseStudy, demo: 'hologram' });
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'projects/alpha/case-study.yaml', path: 'demo' }),
    ]);
  });

  it('reports a missing file without a second complaint about its contents', async () => {
    await rm(join(root, 'cv.yaml'));
    expect(await issues()).toEqual([{ file: 'cv.yaml', path: '', message: 'file is missing' }]);
  });

  it('reports broken YAML with the file name', async () => {
    await put('profile.yaml', 'name: [unclosed');
    const found = await issues();
    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe('profile.yaml');
    expect(found[0]?.message).toMatch(/^not valid YAML/);
  });

  it('rejects fields nobody planned for, such as a phone number', async () => {
    await put('profile.yaml', { ...profile, phone: '+994 00 000 00 00' });
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'profile.yaml', path: '(root)' }),
    ]);
  });

  it('rejects a role that ends before it starts', async () => {
    await put('cv.yaml', { ...cv, experience: [role('Backwards', '2024-05', '2023-01')] });
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'cv.yaml', path: 'experience.0.to' }),
    ]);
  });

  it('requires the headline to be one of the facts', async () => {
    await putProject('alpha', project(2, { headline: 'nowhere' }));
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'projects/alpha/project.yaml', path: 'headline' }),
    ]);
  });

  it('rejects a fact id used twice', async () => {
    const facts = project(2).facts;
    await putProject('alpha', project(2, { facts: [...facts, facts[0]] }));
    expect((await issues()).map((i) => i.path)).toEqual(['facts.2.id']);
  });

  it('keeps private repos unlinked and out of the knowledge base', async () => {
    await putProject('alpha', project(2, { visibility: 'private' }));
    expect((await issues()).map((i) => i.path).sort()).toEqual(['knowledge', 'links.repo']);
  });

  it('needs a repo link for a public project', async () => {
    await putProject(
      'alpha',
      project(2, { links: { live: 'https://example.com' }, knowledge: [] }),
    );
    expect((await issues()).map((i) => i.path)).toEqual(['links.repo']);
  });

  it('rejects two projects with the same order', async () => {
    await putProject('alpha', project(1));
    expect(await issues()).toEqual([
      expect.objectContaining({ path: 'order', message: 'order 1 is already used by alpha' }),
    ]);
  });

  it('rejects an eval question that expects a fact the project does not have', async () => {
    await putProject('alpha', project(2), [...evals, { question: 'Why?', expects: ['ghost'] }]);
    expect(await issues()).toEqual([
      {
        file: 'projects/alpha/evals.yaml',
        path: '3.expects.0',
        message: '"ghost" is not a fact of this project',
      },
    ]);
  });

  it('asks for at least three eval questions', async () => {
    await putProject('alpha', project(2), evals.slice(0, 2));
    expect(await issues()).toEqual([
      expect.objectContaining({ file: 'projects/alpha/evals.yaml', path: '(root)' }),
    ]);
  });

  it('rejects a project folder whose name is not a slug', async () => {
    await putProject('Bad Name', project(3));
    expect(await issues()).toEqual([
      { file: 'projects/Bad Name', path: '', message: 'folder name must be a slug' },
    ]);
  });
});

describe('renderGenerated', () => {
  it('writes a typed module that holds the validated content', async () => {
    const source = renderGenerated(await loadContent(root));
    expect(source).toContain("import type { Content } from '../schema.ts';");
    expect(source).toContain('export const content: Content = {');
    expect(source).toContain('"name": "Test Person"');
  });
});

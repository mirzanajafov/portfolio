import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { z } from 'zod';
import { caseStudiesIn } from './case-studies.ts';
import type * as ContentModule from './index.ts';
import { loadContent } from './load.ts';
import type {
  Content,
  caseStudySchema,
  cvSchema,
  evalsSchema,
  profileSchema,
  projectSchema,
} from './schema.ts';

type ProjectFile = z.input<typeof projectSchema>;
type FactFile = ProjectFile['facts'][number];
type CaseStudyFile = z.input<typeof caseStudySchema>;
type EvalsFile = z.input<typeof evalsSchema>;
type ProfileFile = z.input<typeof profileSchema>;
type CvFile = z.input<typeof cvSchema>;
type RoleFile = CvFile['experience'][number];

export type ProjectFolder = {
  slug: string;
  project: ProjectFile;
  evals: EvalsFile;
  caseStudy?: CaseStudyFile;
};

export function aFact(overrides: Partial<FactFile> = {}): FactFile {
  return {
    id: 'fast',
    text: 'It answers in 40 ms.',
    kind: 'measured',
    source: { file: 'README.md' },
    ...overrides,
  };
}

export function aCaseStudy(overrides: Partial<CaseStudyFile> = {}): CaseStudyFile {
  return {
    problem: 'It was slow.',
    decisions: [
      { title: 'Make it fast', body: 'I made it fast.', facts: ['fast'] },
      { title: 'Keep it small', body: 'I kept it small.', facts: [] },
    ],
    proof: 'A benchmark.',
    next: 'More benchmarks.',
    ...overrides,
  };
}

export function aProject({
  slug = 'demo',
  evals,
  caseStudy,
  ...project
}: Partial<ProjectFile> & {
  slug?: string;
  evals?: EvalsFile;
  caseStudy?: CaseStudyFile;
} = {}): ProjectFolder {
  const name = project.name ?? 'Demo';
  const headline = project.headline ?? 'fast';
  const live = `https://${slug}.example.com`;
  const isPublic = project.visibility !== 'private';
  return {
    slug,
    project: {
      name,
      order: 1,
      hook: `${name} answers before you finish asking`,
      summary: `${name} is a demo that answers quickly.`,
      visibility: 'public',
      links: isPublic ? { live, repo: `https://github.com/someone/${slug}` } : { live },
      stack: ['NestJS', 'Postgres'],
      knowledge: isPublic ? ['README.md'] : [],
      facts: [aFact()],
      headline,
      ...project,
    },
    evals: evals ?? [
      { question: `How fast is ${name}?`, expects: [headline] },
      { question: `Why did you build ${name}?`, expects: [headline] },
      { question: `What does ${name} run on?`, expects: [headline] },
    ],
    caseStudy,
  };
}

export function aRole(overrides: Partial<RoleFile> = {}): RoleFile {
  return {
    company: 'Acme',
    role: 'Backend Engineer',
    kind: 'employee',
    from: '2024-01',
    to: 'present',
    location: 'Baku, Azerbaijan',
    remote: true,
    highlights: ['Moved the billing service to NestJS.'],
    ...overrides,
  };
}

export function aProfile(overrides: Partial<ProfileFile> = {}): ProfileFile {
  return {
    name: 'Ada Lovelace',
    headline: 'Senior Backend Engineer',
    location: 'Baku, Azerbaijan',
    timezone: 'UTC+4',
    availability: 'Open to remote roles',
    summary: 'I build backends that explain themselves.',
    links: {
      email: 'ada@example.com',
      github: 'https://github.com/ada',
      linkedin: 'https://www.linkedin.com/in/ada',
    },
    ...overrides,
  };
}

export function aCv(overrides: Partial<CvFile> = {}): CvFile {
  return {
    experience: [aRole()],
    skills: [{ group: 'Backend', items: ['NestJS', 'Postgres'] }],
    languages: [{ name: 'English', level: 'Professional' }],
    ...overrides,
  };
}

export async function contentOf({
  profile = aProfile(),
  cv = aCv(),
  projects = [aProject()],
}: {
  profile?: ProfileFile;
  cv?: CvFile;
  projects?: ProjectFolder[];
} = {}): Promise<Content> {
  const root = await mkdtemp(join(tmpdir(), 'content-'));
  try {
    await writeFile(join(root, 'profile.yaml'), stringify(profile));
    await writeFile(join(root, 'cv.yaml'), stringify(cv));
    for (const { slug, project, evals, caseStudy } of projects) {
      const folder = join(root, 'projects', slug);
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, 'project.yaml'), stringify(project));
      await writeFile(join(folder, 'evals.yaml'), stringify(evals));
      if (caseStudy) {
        await writeFile(join(folder, 'case-study.yaml'), stringify(caseStudy));
      }
    }
    return await loadContent(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function contentModule(content: Content): typeof ContentModule {
  return { content, ...caseStudiesIn(content.projects) };
}

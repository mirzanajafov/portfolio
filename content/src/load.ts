import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import {
  caseStudySchema,
  cvSchema,
  evalsSchema,
  profileSchema,
  projectSchema,
  slugSchema,
  type Content,
  type Cv,
  type Project,
  type ProjectFile,
  type Role,
  type UsedProject,
} from './schema.ts';

export type ContentIssue = {
  file: string;
  path: string;
  message: string;
};

export class ContentError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(issues.map((issue) => `${issue.file} ${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'ContentError';
    this.issues = issues;
  }
}

type Read = { ok: true; value: unknown } | { ok: false };

async function readYaml(root: string, file: string, issues: ContentIssue[]): Promise<Read> {
  let text: string;
  try {
    text = await readFile(join(root, file), 'utf8');
  } catch {
    issues.push({ file, path: '', message: 'file is missing' });
    return { ok: false };
  }
  try {
    return { ok: true, value: parse(text) };
  } catch (error) {
    issues.push({ file, path: '', message: `not valid YAML: ${(error as Error).message}` });
    return { ok: false };
  }
}

function check<T>(
  schema: z.ZodType<T>,
  read: Read,
  file: string,
  issues: ContentIssue[],
): T | undefined {
  if (!read.ok) {
    return undefined;
  }
  const result = schema.safeParse(read.value);
  if (result.success) {
    return result.data;
  }
  for (const issue of result.error.issues) {
    issues.push({ file, path: issue.path.join('.') || '(root)', message: issue.message });
  }
  return undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function newestFirst(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => b.from.localeCompare(a.from));
}

async function loadProject(
  root: string,
  slug: string,
  issues: ContentIssue[],
): Promise<ProjectFile | undefined> {
  const dir = `projects/${slug}`;
  if (!slugSchema.safeParse(slug).success) {
    issues.push({ file: dir, path: '', message: 'folder name must be a slug' });
    return undefined;
  }
  const projectFile = `${dir}/project.yaml`;
  const evalsFile = `${dir}/evals.yaml`;
  const project = check(
    projectSchema,
    await readYaml(root, projectFile, issues),
    projectFile,
    issues,
  );
  const evals = check(evalsSchema, await readYaml(root, evalsFile, issues), evalsFile, issues);
  if (!project || !evals) {
    return undefined;
  }
  const factIds = new Set(project.facts.map((fact) => fact.id));
  evals.forEach((question, index) => {
    question.expects.forEach((id, at) => {
      if (!factIds.has(id)) {
        issues.push({
          file: evalsFile,
          path: `${index}.expects.${at}`,
          message: `"${id}" is not a fact of this project`,
        });
      }
    });
  });
  const caseStudyFile = `${dir}/case-study.yaml`;
  if (!(await exists(join(root, caseStudyFile)))) {
    return { ...project, slug, evals };
  }
  const caseStudy = check(
    caseStudySchema,
    await readYaml(root, caseStudyFile, issues),
    caseStudyFile,
    issues,
  );
  caseStudy?.decisions.forEach((decision, index) => {
    decision.facts.forEach((id, at) => {
      if (!factIds.has(id)) {
        issues.push({
          file: caseStudyFile,
          path: `decisions.${index}.facts.${at}`,
          message: `"${id}" is not a fact of this project`,
        });
      }
    });
  });
  if (caseStudy && Boolean(caseStudy.demo) !== Boolean(caseStudy.demoCaption)) {
    issues.push({
      file: caseStudyFile,
      path: 'demoCaption',
      message: 'a demo needs a caption that says what it shows, and a caption needs a demo',
    });
  }
  return caseStudy ? { ...project, slug, evals, caseStudy } : { ...project, slug, evals };
}

function resolveUses(
  project: ProjectFile,
  folders: string[],
  names: Map<string, string>,
  issues: ContentIssue[],
): UsedProject[] {
  const used: UsedProject[] = [];
  project.uses.forEach((use, index) => {
    const at = { file: `projects/${project.slug}/project.yaml`, path: `uses.${index}.project` };
    const name = names.get(use.project);
    if (use.project === project.slug || !folders.includes(use.project)) {
      issues.push({ ...at, message: `"${use.project}" is not another project` });
    } else if (used.some((entry) => entry.slug === use.project)) {
      issues.push({ ...at, message: `"${use.project}" is used twice` });
    } else if (name) {
      used.push({ slug: use.project, name, for: use.for });
    }
  });
  return used;
}

async function loadProjects(root: string, issues: ContentIssue[]): Promise<Project[]> {
  let entries;
  try {
    entries = await readdir(join(root, 'projects'), { withFileTypes: true });
  } catch {
    issues.push({ file: 'projects', path: '', message: 'folder is missing' });
    return [];
  }
  const slugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const projects: ProjectFile[] = [];
  for (const slug of slugs) {
    const project = await loadProject(root, slug, issues);
    if (project) {
      projects.push(project);
    }
  }
  const byOrder = new Map<number, string>();
  for (const project of projects) {
    const taken = byOrder.get(project.order);
    if (taken) {
      issues.push({
        file: `projects/${project.slug}/project.yaml`,
        path: 'order',
        message: `order ${project.order} is already used by ${taken}`,
      });
    }
    byOrder.set(project.order, project.slug);
  }
  const names = new Map(projects.map((project) => [project.slug, project.name]));
  return projects
    .sort((a, b) => a.order - b.order)
    .map((project) => ({ ...project, uses: resolveUses(project, slugs, names, issues) }));
}

export async function loadContent(root: string): Promise<Content> {
  const issues: ContentIssue[] = [];
  const profile = check(
    profileSchema,
    await readYaml(root, 'profile.yaml', issues),
    'profile.yaml',
    issues,
  );
  const cv = check(cvSchema, await readYaml(root, 'cv.yaml', issues), 'cv.yaml', issues);
  const projects = await loadProjects(root, issues);
  if (issues.length > 0 || !profile || !cv) {
    throw new ContentError(issues);
  }
  const sortedCv: Cv = {
    ...cv,
    experience: newestFirst(cv.experience),
    mentoring: newestFirst(cv.mentoring),
  };
  return { profile, cv: sortedCv, projects };
}

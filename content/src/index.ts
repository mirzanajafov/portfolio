import { content } from './.generated/data.ts';
import type { CaseStudy, Project } from './schema.ts';

type ProjectWithCaseStudy = Project & { caseStudy: CaseStudy };

export const projectsWithCaseStudy = content.projects.filter(
  (project): project is ProjectWithCaseStudy => project.caseStudy !== undefined,
);

export function findProjectWithCaseStudy(slug: string): ProjectWithCaseStudy | undefined {
  return projectsWithCaseStudy.find((project) => project.slug === slug);
}

export { content };
export type {
  CaseStudy,
  Content,
  Cv,
  DemoName,
  EvalQuestion,
  Fact,
  Profile,
  Project,
  Role,
  UsedProject,
} from './schema.ts';

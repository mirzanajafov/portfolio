import { content } from './.generated/data.ts';
import type { CaseStudy, Project } from './schema.ts';

export type ProjectWithCaseStudy = Project & { caseStudy: CaseStudy };

export const caseStudies = content.projects.filter(
  (project): project is ProjectWithCaseStudy => project.caseStudy !== undefined,
);

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

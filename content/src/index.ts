import { content } from './.generated/data.ts';
import { caseStudiesIn } from './case-studies.ts';

export const { projectsWithCaseStudy, findProjectWithCaseStudy } = caseStudiesIn(content.projects);

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

import { content } from './.generated/data.ts';
import { caseStudiesIn } from './case-studies.ts';
import { siteUrl } from './site.ts';

export const { projectsWithCaseStudy, findProjectWithCaseStudy } = caseStudiesIn(content.projects);

export { caseStudiesIn, content, siteUrl };
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

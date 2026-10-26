import type { CaseStudy, Project } from './schema.ts';

type ProjectWithCaseStudy = Project & { caseStudy: CaseStudy };

export function caseStudiesIn(projects: Project[]) {
  const projectsWithCaseStudy = projects.filter(
    (project): project is ProjectWithCaseStudy => project.caseStudy !== undefined,
  );
  return {
    projectsWithCaseStudy,
    findProjectWithCaseStudy: (slug: string): ProjectWithCaseStudy | undefined =>
      projectsWithCaseStudy.find((project) => project.slug === slug),
  };
}

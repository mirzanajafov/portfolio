import type { Fact, Project, Role } from '@portfolio/content';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  const name = months[Number(month) - 1];
  if (!year || !name) {
    throw new Error(`not a YYYY-MM month: ${value}`);
  }
  return `${name} ${year}`;
}

export function formatPeriod(role: Pick<Role, 'from' | 'to'>): string {
  const end = role.to === 'present' ? 'present' : formatMonth(role.to);
  return `${formatMonth(role.from)} – ${end}`;
}

const kindLabels: Record<Role['kind'], string | null> = {
  employee: null,
  contract: 'Contract',
  freelance: 'Freelance',
  'part-time': 'Part-time',
};

export function kindLabel(kind: Role['kind']): string | null {
  return kindLabels[kind];
}

export function roleKey(role: Pick<Role, 'company' | 'role' | 'from'>): string {
  return `${role.company ?? role.role}-${role.from}`;
}

export type UsedProject = { slug: string; name: string; for: string };

export function usedProjects(project: Project, projects: Project[]): UsedProject[] {
  return project.uses.map((use) => {
    const used = projects.find((candidate) => candidate.slug === use.project);
    if (!used) {
      throw new Error(`${project.slug} uses ${use.project}, which is not a project`);
    }
    return { slug: used.slug, name: used.name, for: use.for };
  });
}

export function headlineFact(project: Project): Fact {
  const fact = project.facts.find((candidate) => candidate.id === project.headline);
  if (!fact) {
    throw new Error(`${project.slug} has no fact called ${project.headline}`);
  }
  return fact;
}

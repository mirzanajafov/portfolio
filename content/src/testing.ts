import { caseStudiesIn } from './case-studies.ts';
import type { CaseStudy, Content, Cv, Fact, Profile, Project, Role } from './schema.ts';

export function aFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: 'fast',
    text: 'It answers in 40 ms.',
    kind: 'measured',
    source: { file: 'README.md' },
    ...overrides,
  };
}

export function aCaseStudy(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    problem: 'It was slow.',
    decisions: [
      { title: 'Make it fast', body: 'I made it fast.', facts: [aFact()] },
      { title: 'Keep it small', body: 'I kept it small.', facts: [] },
    ],
    proof: 'A benchmark.',
    next: 'More benchmarks.',
    ...overrides,
  };
}

export function aProject(overrides: Partial<Project> = {}): Project {
  const headline = overrides.headline ?? aFact();
  return {
    slug: 'demo',
    name: 'Demo',
    order: 1,
    hook: 'Answers before you finish asking',
    summary: 'A demo that answers quickly.',
    visibility: 'public',
    links: { live: 'https://demo.example.com', repo: 'https://github.com/someone/demo' },
    stack: ['NestJS', 'Postgres'],
    uses: [],
    headline,
    facts: [headline],
    knowledge: ['README.md'],
    evals: [{ question: 'How fast is the demo?', expects: [headline.id] }],
    ...overrides,
  };
}

export function aRole(overrides: Partial<Role> = {}): Role {
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

export function aProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: 'Ada Lovelace',
    alternateNames: [],
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

export function aCv(overrides: Partial<Cv> = {}): Cv {
  return {
    experience: [aRole()],
    mentoring: [],
    skills: [{ group: 'Backend', items: ['NestJS', 'Postgres'] }],
    languages: [{ name: 'English', level: 'Professional' }],
    ...overrides,
  };
}

export function someContent(overrides: Partial<Content> = {}): Content {
  return { profile: aProfile(), cv: aCv(), projects: [aProject()], ...overrides };
}

export function contentModule(content: Content) {
  return { content, ...caseStudiesIn(content.projects) };
}

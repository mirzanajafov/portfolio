import type { Content, Role } from '@portfolio/content';
import type { AskSource } from '@portfolio/content/ask';

export type KnowledgeDocument = {
  id: string;
  kind: 'profile' | 'cv' | 'summary' | 'fact' | 'case-study';
  project?: string;
  text: string;
  keywords: string;
  source: AskSource;
  backs?: string[];
};

export class Knowledge {
  readonly documents: readonly KnowledgeDocument[];
  readonly projectNames: ReadonlyMap<string, string>;
  private readonly byId: ReadonlyMap<string, KnowledgeDocument>;

  constructor(documents: KnowledgeDocument[], projectNames: Map<string, string>) {
    this.documents = documents;
    this.projectNames = projectNames;
    this.byId = new Map(documents.map((document) => [document.id, document]));
  }

  get(id: string): KnowledgeDocument | undefined {
    return this.byId.get(id);
  }
}

function roleId(role: Role): string {
  const name = (role.company ?? role.role).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `cv/${name.replace(/^-|-$/g, '')}-${role.from}`;
}

function roleTitle(role: Role): string {
  return role.company ? `${role.role} at ${role.company}` : role.role;
}

function rolePeriod(role: Role): string {
  return `${role.from} to ${role.to === 'present' ? 'now' : role.to}`;
}

function describeRole(role: Role): string {
  const place = role.remote ? `${role.location}, remote` : role.location;
  return [`${roleTitle(role)}, ${rolePeriod(role)} (${place}).`, role.about]
    .filter(Boolean)
    .join(' ');
}

export function buildKnowledge(content: Content): Knowledge {
  const { profile, cv, projects } = content;
  const documents: KnowledgeDocument[] = [
    {
      id: 'profile',
      kind: 'profile',
      text: `${profile.summary} ${profile.availability}, based in ${profile.location} (${profile.timezone}).`,
      keywords: `${profile.name} ${profile.headline} about me who are you remote relocation location`,
      source: { id: 'profile', label: 'About me', href: '/' },
    },
  ];

  for (const role of [...cv.experience, ...cv.mentoring]) {
    const id = roleId(role);
    const label = `CV · ${role.company ?? role.role}`;
    const keywords = `${roleTitle(role)} work job experience career ${role.kind} ${role.remote ? 'remote' : ''}`;
    documents.push({
      id,
      kind: 'cv',
      text: describeRole(role),
      keywords,
      source: { id, label, href: '/cv' },
    });
    role.highlights.forEach((highlight, index) => {
      const highlightId = `${id}/${index + 1}`;
      documents.push({
        id: highlightId,
        kind: 'cv',
        text: `${roleTitle(role)} (${rolePeriod(role)}): ${highlight}`,
        keywords,
        source: { id: highlightId, label, href: '/cv' },
      });
    });
  }

  documents.push({
    id: 'cv/skills',
    kind: 'cv',
    text: cv.skills.map((skill) => `${skill.group}: ${skill.items.join(', ')}.`).join(' '),
    keywords: 'skills stack technologies tools languages frameworks',
    source: { id: 'cv/skills', label: 'CV · Skills', href: '/cv' },
  });
  documents.push({
    id: 'cv/languages',
    kind: 'cv',
    text: cv.languages.map((language) => `${language.name}: ${language.level}.`).join(' '),
    keywords: 'speak spoken languages english',
    source: { id: 'cv/languages', label: 'CV · Languages', href: '/cv' },
  });

  const projectNames = new Map<string, string>();
  for (const project of projects) {
    projectNames.set(project.slug, project.name);
    const keywords = `${project.name} ${project.hook} ${project.stack.join(' ')}`;
    const summaryId = `${project.slug}/summary`;
    documents.push({
      id: summaryId,
      kind: 'summary',
      project: project.slug,
      text: project.summary,
      keywords: `${keywords} what is it about built`,
      source: {
        id: summaryId,
        label: project.name,
        href: project.links.repo ?? project.links.live,
      },
    });
    for (const fact of project.facts) {
      const id = `${project.slug}/${fact.id}`;
      documents.push({
        id,
        kind: 'fact',
        project: project.slug,
        text: fact.text,
        keywords,
        source: { id, label: `${project.name} · ${fact.source.file}`, href: fact.source.href },
      });
    }
    const study = project.caseStudy;
    if (study) {
      const passages = [
        { part: 'why', text: study.problem, topic: 'why built problem motivation idea', backs: [] },
        ...study.decisions.map((decision, index) => ({
          part: `decision-${index + 1}`,
          text: decision.body,
          topic: decision.title,
          backs: decision.facts.map((fact) => `${project.slug}/${fact.id}`),
        })),
        {
          part: 'proof',
          text: study.proof,
          topic: 'tested testing tests prove proof works',
          backs: [],
        },
        { part: 'next', text: study.next, topic: 'next improve change future plans', backs: [] },
      ];
      for (const { part, text, topic, backs } of passages) {
        const id = `${project.slug}/case-study/${part}`;
        documents.push({
          id,
          kind: 'case-study',
          project: project.slug,
          text,
          keywords: `${keywords} ${topic}`,
          source: { id, label: `${project.name} · case study`, href: `/projects/${project.slug}` },
          backs,
        });
      }
    }
  }

  return new Knowledge(documents, projectNames);
}

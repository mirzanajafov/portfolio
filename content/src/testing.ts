import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { z } from 'zod';
import type { ApplicationPage, ApplicationView } from './applications.ts';
import { caseStudiesIn } from './case-studies.ts';
import type * as ContentModule from './index.ts';
import { loadContent } from './load.ts';
import type { ApplicationEntry, ApplicationTally, Report, Totals } from './report.ts';
import { siteUrl } from './site.ts';
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

type ProjectFolder = {
  slug: string;
  project: ProjectFile;
  evals: EvalsFile;
  caseStudy?: CaseStudyFile;
};

export const pausePunctuation = /[;\u2014]| --? /;

export const phoneNumber = /(?:(?<!\w)\+|\b0)(?:[\s().-]*\d){9,}/;

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
  const slugs = projects.map((folder) => folder.slug);
  const repeated = slugs.find((slug, index) => slugs.indexOf(slug) !== index);
  if (repeated) {
    throw new Error(`two fixture projects use the slug ${repeated}`);
  }
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
  return { content, caseStudiesIn, siteUrl, ...caseStudiesIn(content.projects) };
}

export const someVisits = (visits: number): Totals => ({
  visits,
  pageViews: visits * 3,
  medianVisitSeconds: 40,
  phoneVisits: 1,
  quickExits: 0,
  openedDemo: 0,
  didDemoStep: 0,
});

const noOutcome = () => ({ right: 0, wrong: 0, tied: 0 });

export const noOutcomes = () => ({ high: noOutcome(), medium: noOutcome(), low: noOutcome() });

export function anApplicationView(overrides: Partial<ApplicationView> = {}): ApplicationView {
  return {
    code: 'memh',
    company: 'Acme',
    role: 'Backend Engineer',
    appliedOn: '2026-10-30',
    channel: 'direct',
    cvVariant: 'base',
    status: 'sent',
    answeredOn: null,
    notes: '',
    firstSeenOn: null,
    country: null,
    city: null,
    atsHost: null,
    networks: [],
    version: 0,
    ...overrides,
  };
}

export function anApplicationPage(overrides: Partial<ApplicationPage> = {}): ApplicationPage {
  return { ...anApplicationView(), undoTo: null, ...overrides };
}

export function aReport(overrides: Partial<Report> = {}): Report {
  return {
    period: {
      from: new Date('2026-10-23T00:00:00Z'),
      to: new Date('2026-10-30T12:00:00Z'),
      days: 7,
      visits: 14,
    },
    rollupBehind: null,
    overview: { today: someVisits(2), current: someVisits(12), previous: someVisits(8) },
    weeks: [],
    sources: [],
    otherSites: [],
    entries: [],
    journeys: [],
    pages: [],
    reading: [],
    links: { cvViews: 0, cvPdf: [], outbound: [] },
    demos: { opened: 0, didStep: 0, demoOnly: 0, list: [] },
    ask: { since: null, questions: 0, refused: 0, inVisits: 0, visits: 0, days: [] },
    audience: { devices: [], browsers: [], countries: [] },
    dataCenters: { demoOnly: 0, list: [] },
    quality: { vitals: [], errors: [], notFound: [] },
    filter: [],
    applications: someApplications(),
    alerts: { givenUp: 0 },
    ...overrides,
  };
}

function aReading(path: string): Report['reading'][number] {
  return {
    path,
    views: 3,
    medianSeconds: 12,
    medianScroll: 40,
    blocks: [{ block: 'problem', readers: 2, medianSeconds: 8 }],
  };
}

export function aFullReport(overrides: Partial<Report> = {}): Report {
  const vital = { p75: 1200, samples: 4, rating: 'good' as const, missesMyBar: false };
  return aReport({
    rollupBehind: { from: '2026-09-28', to: '2026-09-29' },
    weeks: [{ ...someVisits(5), start: '2026-10-26', partial: true }],
    sources: [{ source: 'direct', visits: 9 }],
    otherSites: [{ host: 'news.ycombinator.com', visits: 2 }],
    entries: [{ path: '/', visits: 8 }],
    journeys: [{ paths: ['/', '/cv'], visits: 3 }],
    pages: [{ path: '/', views: 10, visits: 8, medianSeconds: 12, medianScroll: 40, exits: 4 }],
    reading: [aReading('/'), aReading('/projects/matchium')],
    links: {
      cvViews: 3,
      cvPdf: [{ from: '/cv', clicks: 2 }],
      outbound: [{ label: 'Matchium live', clicks: 1 }],
    },
    demos: {
      opened: 2,
      didStep: 1,
      demoOnly: 1,
      list: [
        {
          name: 'Matchium',
          clicked: 2,
          fromSite: 2,
          clickedNotOpened: 0,
          demoOnly: [{ source: 'direct', visits: 1 }],
          didStep: 1,
          steps: [{ label: 'answered a question', visits: 1 }],
          medianSeconds: 60,
        },
      ],
    },
    ask: {
      since: null,
      questions: 2,
      refused: 0,
      inVisits: 1,
      visits: 1,
      days: [{ day: '2026-10-30', questions: 2, refused: 0 }],
    },
    audience: {
      devices: [{ name: 'desktop', visits: 9 }],
      browsers: [{ name: 'chrome', visits: 9 }],
      countries: [{ name: 'AZ', visits: 9 }],
    },
    dataCenters: {
      demoOnly: 1,
      list: [{ owner: 'Amazon.com, Inc.', visits: 2, pageViews: 3, medianSeconds: 0 }],
    },
    quality: {
      vitals: [{ path: '/', device: 'desktop', lcp: vital, inp: vital, cls: null }],
      errors: [{ message: 'boom', source: '/x.js', count: 1, paths: ['/'], browsers: ['chrome'] }],
      notFound: [{ path: '/old', views: 1, referrers: [] }],
    },
    filter: [{ day: '2026-10-30', bot: 1, limited: 0, origin: 0, own: 1 }],
    applications: someApplications({
      list: [anEntry()],
      byChannel: [aTally('direct')],
      byVariant: [aTally('base')],
      unknownCodes: [{ code: 'check1', visits: 1, firstSeen: new Date('2026-10-30T08:00:00Z') }],
    }),
    alerts: { givenUp: 1 },
    ...overrides,
  });
}

export function someApplications(
  overrides: Partial<Report['applications']> = {},
): Report['applications'] {
  return {
    list: [],
    byChannel: [],
    byVariant: [],
    score: { visits: 0, unplaced: 0, levels: noOutcomes() },
    unknownCodes: [],
    ...overrides,
  };
}

export function aTally<Name extends string>(
  name: Name,
  overrides: Partial<Omit<ApplicationTally, 'name'>> = {},
): ApplicationTally & { name: Name } {
  return {
    name,
    applications: 1,
    opened: 0,
    oldEnough: 0,
    answered: 0,
    medianDays: null,
    ...overrides,
  };
}

export function anEntry(overrides: Partial<ApplicationEntry> = {}): ApplicationEntry {
  return {
    code: 'memh',
    company: 'Xsolla',
    role: 'Backend Engineer',
    appliedOn: '2026-10-29',
    firstSeenOn: null,
    channel: 'direct',
    cvVariant: 'base',
    status: 'sent',
    daysToAnswer: null,
    visits: [],
    days: [],
    guesses: [],
    ...overrides,
  };
}

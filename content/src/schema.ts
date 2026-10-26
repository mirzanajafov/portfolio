import { z } from 'zod';
import { questionMaxLength } from './ask.ts';

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase letters, digits and single dashes');

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use YYYY-MM');

export const profileSchema = z.strictObject({
  name: z.string().min(1),
  alternateNames: z.array(z.string().min(1)).default([]),
  headline: z.string().min(1),
  location: z.string().min(1),
  timezone: z.string().regex(/^UTC[+-]\d{1,2}$/),
  availability: z.string().min(1),
  summary: z.string().min(1).max(400),
  links: z.strictObject({
    email: z.email(),
    github: z.url(),
    linkedin: z.url(),
  }),
});

const roleSchema = z
  .strictObject({
    company: z.string().min(1).optional(),
    role: z.string().min(1),
    kind: z.enum(['employee', 'contract', 'freelance', 'part-time']),
    from: yearMonth,
    to: z.union([yearMonth, z.literal('present')]),
    location: z.string().min(1),
    remote: z.boolean(),
    about: z.string().min(1).optional(),
    highlights: z.array(z.string().min(1)).min(1),
  })
  .refine((role) => role.to === 'present' || role.from <= role.to, {
    message: 'ends before it starts',
    path: ['to'],
  });

export const cvSchema = z.strictObject({
  experience: z.array(roleSchema).min(1),
  mentoring: z.array(roleSchema).default([]),
  skills: z
    .array(z.strictObject({ group: z.string().min(1), items: z.array(z.string().min(1)).min(1) }))
    .min(1),
  languages: z.array(z.strictObject({ name: z.string().min(1), level: z.string().min(1) })).min(1),
});

const factSchema = z.strictObject({
  id: slugSchema,
  text: z.string().min(1).max(240),
  kind: z.enum(['measured', 'parameter', 'design']),
  source: z.strictObject({
    file: z.string().min(1),
    section: z.string().min(1).optional(),
  }),
});

export const projectSchema = z
  .strictObject({
    name: z.string().min(1),
    order: z.number().int().positive(),
    hook: z.string().min(1).max(90),
    summary: z.string().min(1).max(400),
    visibility: z.enum(['public', 'private']),
    links: z.strictObject({
      live: z.url(),
      repo: z.url().optional(),
    }),
    stack: z.array(z.string().min(1)).min(1),
    uses: z
      .array(z.strictObject({ project: slugSchema, for: z.string().min(1).max(60) }))
      .default([]),
    headline: slugSchema,
    facts: z.array(factSchema).min(1),
    health: z.url().optional(),
    knowledge: z.array(z.string().min(1)).default([]),
  })
  .superRefine((project, ctx) => {
    const ids = new Set<string>();
    project.facts.forEach((fact, index) => {
      if (ids.has(fact.id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'fact id is used twice',
          path: ['facts', index, 'id'],
        });
      }
      ids.add(fact.id);
    });
    const used = new Set<string>();
    project.uses.forEach((use, index) => {
      if (used.has(use.project)) {
        ctx.addIssue({
          code: 'custom',
          message: 'project is used twice',
          path: ['uses', index, 'project'],
        });
      }
      used.add(use.project);
    });
    if (!ids.has(project.headline)) {
      ctx.addIssue({
        code: 'custom',
        message: 'headline must be the id of a fact',
        path: ['headline'],
      });
    }
    if (project.visibility === 'public' && !project.links.repo) {
      ctx.addIssue({
        code: 'custom',
        message: 'a public project needs its repo link',
        path: ['links', 'repo'],
      });
    }
    if (project.visibility === 'private' && project.links.repo) {
      ctx.addIssue({
        code: 'custom',
        message: 'a private repo must not be linked',
        path: ['links', 'repo'],
      });
    }
    if (project.visibility === 'private' && project.knowledge.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'a private project contributes only its facts, never repo files',
        path: ['knowledge'],
      });
    }
  });

const demoNames = ['floor', 'population', 'storm', 'failover', 'campaign', 'commission'] as const;

export const caseStudySchema = z.strictObject({
  problem: z.string().min(1).max(600),
  demo: z.enum(demoNames).optional(),
  demoCaption: z.string().min(1).max(400).optional(),
  decisions: z
    .array(
      z.strictObject({
        title: z.string().min(1).max(80),
        body: z.string().min(1).max(900),
        facts: z.array(slugSchema).default([]),
      }),
    )
    .min(2)
    .max(4),
  proof: z.string().min(1).max(900),
  next: z.string().min(1).max(600),
});

const evalSchema = z.strictObject({
  question: z.string().min(1).max(questionMaxLength),
  expects: z.array(slugSchema).min(1),
});

export const evalsSchema = z.array(evalSchema).min(3, 'write at least three questions');

export type Profile = z.infer<typeof profileSchema>;
export type Cv = z.infer<typeof cvSchema>;
export type Role = Cv['experience'][number];
export type EvalQuestion = z.infer<typeof evalSchema>;
export type DemoName = (typeof demoNames)[number];

type FactFile = z.infer<typeof factSchema>;
export type Fact = FactFile & { source: FactFile['source'] & { href?: string } };

type CaseStudyFile = z.infer<typeof caseStudySchema>;
type Decision = Omit<CaseStudyFile['decisions'][number], 'facts'> & { facts: Fact[] };
export type CaseStudy = Omit<CaseStudyFile, 'decisions'> & { decisions: Decision[] };

export type UsedProject = { slug: string; name: string; for: string };
export type UnlinkedProject = Omit<z.infer<typeof projectSchema>, 'headline' | 'facts'> & {
  slug: string;
  headline: Fact;
  facts: Fact[];
  evals: EvalQuestion[];
  caseStudy?: CaseStudy;
};
export type Project = Omit<UnlinkedProject, 'uses'> & { uses: UsedProject[] };

export type Content = {
  profile: Profile;
  cv: Cv;
  projects: Project[];
};

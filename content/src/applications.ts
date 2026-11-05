import * as z from 'zod/mini';

export const channels = ['referral', 'direct', 'recruiter'] as const;

export const statuses = [
  'sent',
  'screening',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type Status = (typeof statuses)[number];

export const guessWindowDays = 14;

export const nextStatuses: Record<Status, readonly Status[]> = {
  sent: ['screening', 'interview', 'offer', 'rejected', 'withdrawn'],
  screening: ['interview', 'offer', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['accepted', 'rejected', 'withdrawn'],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export function isAnswer(from: Status, to: Status): boolean {
  return from === 'sent' && to !== 'sent' && to !== 'withdrawn';
}

export const applicationViewSchema = z.object({
  code: z.string(),
  company: z.string(),
  role: z.string(),
  appliedOn: z.string(),
  channel: z.enum(channels),
  cvVariant: z.string(),
  status: z.enum(statuses),
  answeredOn: z.nullable(z.string()),
  notes: z.string(),
  firstSeenOn: z.nullable(z.string()),
  country: z.nullable(z.string()),
  city: z.nullable(z.string()),
  atsHost: z.nullable(z.string()),
  networks: z.array(z.string()),
  version: z.number(),
});

export type ApplicationView = z.infer<typeof applicationViewSchema>;

export const applicationListSchema = z.array(applicationViewSchema);

export const applicationPageSchema = z.extend(applicationViewSchema, {
  undoTo: z.nullable(z.enum(statuses)),
});

export type ApplicationPage = z.infer<typeof applicationPageSchema>;

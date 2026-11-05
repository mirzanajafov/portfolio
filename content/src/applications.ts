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

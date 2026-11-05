import { describe, expect, it } from 'vitest';
import { isAnswer, nextStatuses, statuses, type Status } from './applications.ts';

describe('nextStatuses', () => {
  it('lets an answer skip steps, from sent straight to an interview or an offer', () => {
    expect(nextStatuses('sent')).toEqual([
      'screening',
      'interview',
      'offer',
      'rejected',
      'withdrawn',
    ]);
  });

  it('only moves forward, so no status leads back to one before it', () => {
    for (const [index, status] of statuses.entries()) {
      const earlier = statuses.slice(0, index);
      expect(nextStatuses(status).filter((to) => earlier.includes(to))).toEqual([]);
    }
  });

  it('ends the search at accepted, rejected or withdrawn, and an offer can end in any of them', () => {
    expect(nextStatuses('offer')).toEqual(['accepted', 'rejected', 'withdrawn']);
    const ends: Status[] = ['accepted', 'rejected', 'withdrawn'];
    expect(ends.map((status) => nextStatuses(status))).toEqual([[], [], []]);
  });
});

describe('isAnswer', () => {
  it('counts leaving sent as an answer, unless I withdrew before one came', () => {
    expect(isAnswer('sent', 'rejected')).toBe(true);
    expect(isAnswer('sent', 'sent')).toBe(false);
    expect(isAnswer('sent', 'withdrawn')).toBe(false);
    expect(isAnswer('screening', 'interview')).toBe(false);
  });
});

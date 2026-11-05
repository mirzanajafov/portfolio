import { describe, expect, it } from 'vitest';
import { firstVisitText } from './first-visit-text.js';

describe('firstVisitText', () => {
  it('says which application it was, the first page and the time in Baku', () => {
    expect(
      firstVisitText(
        { company: 'Xsolla', role: 'Backend Engineer' },
        'the CV',
        new Date('2026-11-05T10:07:00Z'),
      ),
    ).toBe(
      'Xsolla, Backend Engineer: someone opened your link, first the CV, at 2026-11-05 14:07 Baku time.',
    );
  });
});

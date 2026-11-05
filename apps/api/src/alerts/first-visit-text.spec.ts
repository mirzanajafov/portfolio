import { describe, expect, it } from 'vitest';
import { firstVisitText } from './first-visit-text.js';

const xsolla = { company: 'Xsolla', role: 'Backend Engineer' };
const at = new Date('2026-11-05T10:07:00Z');

describe('firstVisitText', () => {
  it('says which application it was, the first page and the time in Baku', () => {
    expect(firstVisitText(xsolla, { path: '/cv', demoName: null }, at)).toBe(
      'Xsolla, Backend Engineer: someone opened your link, first /cv, at 2026-11-05 14:07 Baku time.',
    );
  });

  it('names the demo instead of its path when the first page was in a demo', () => {
    expect(firstVisitText(xsolla, { path: '/today', demoName: 'Matchium' }, at)).toBe(
      'Xsolla, Backend Engineer: someone opened your link, first the Matchium demo, at 2026-11-05 14:07 Baku time.',
    );
  });
});

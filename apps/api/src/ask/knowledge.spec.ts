import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import { buildKnowledge } from './knowledge.js';
import { gateSentence } from './sentence-gate.js';

describe('the knowledge built from the real content', () => {
  it('has no document the gate would withhold or change, so Ask cites every one as written', () => {
    const misfits = buildKnowledge(content).documents.flatMap((document) => {
      const verdict = gateSentence({ text: document.text, sourceCount: 1 }, '', 0);
      if (!verdict.ok) {
        return [`${document.id}: ${verdict.reason}`];
      }
      return verdict.text === document.text ? [] : [`${document.id}: changed`];
    });
    expect(misfits).toEqual([]);
  });
});

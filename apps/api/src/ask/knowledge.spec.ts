import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import { buildKnowledge } from './knowledge.js';
import { gateSentence } from './sentence-gate.js';

describe('the knowledge built from the real content', () => {
  it('has no document the gate would withhold, so Ask can cite every one', () => {
    const withheld = buildKnowledge(content).documents.flatMap((document) => {
      const verdict = gateSentence({ text: document.text, sourceCount: 1 }, '', 0);
      return verdict.ok ? [] : [`${document.id}: ${verdict.reason}`];
    });
    expect(withheld).toEqual([]);
  });
});

import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import { buildKnowledge } from './knowledge.js';
import { gateSentence } from './sentence-gate.js';

describe('the knowledge built from the real content', () => {
  it('has no document the gate would withhold or change when it is the first sentence of an answer', () => {
    const { documents } = buildKnowledge(content);
    expect(
      documents.map((document) => [
        document.id,
        gateSentence({ text: document.text, sourceCount: 1 }, '', 0),
      ]),
    ).toEqual(documents.map((document) => [document.id, { ok: true, text: document.text }]));
  });
});

import { content } from '@portfolio/content';
import { answerMaxLength } from '@portfolio/content/ask';
import { describe, expect, it } from 'vitest';
import { buildKnowledge } from './knowledge.js';

describe('the knowledge built from the real content', () => {
  it('has no document longer than one answer, so Ask can cite every one', () => {
    const tooLong = buildKnowledge(content)
      .documents.filter((document) => document.text.length > answerMaxLength)
      .map((document) => `${document.id} (${String(document.text.length)})`);
    expect(tooLong).toEqual([]);
  });
});

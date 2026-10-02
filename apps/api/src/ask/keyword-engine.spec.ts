import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import type { DraftSentence } from './answer-engine.js';
import { KeywordAnswerEngine, tokenize } from './keyword-engine.js';
import { buildKnowledge } from './knowledge.js';

const engine = new KeywordAnswerEngine(buildKnowledge(content));

async function draft(question: string): Promise<DraftSentence[]> {
  const sentences: DraftSentence[] = [];
  for await (const sentence of engine.answer(question, new AbortController().signal)) {
    sentences.push(sentence);
  }
  return sentences;
}

describe('tokenize', () => {
  it('drops stopwords and folds simple plurals', () => {
    expect(tokenize('How do the questions work?')).toEqual(['question', 'work']);
  });

  it('keeps names like Node.js and Next.js whole', () => {
    expect(tokenize('Node.js or Next.js.')).toEqual(['node.js', 'next.js']);
  });
});

describe('KeywordAnswerEngine', () => {
  it('answers from the fact that matches, and cites it', async () => {
    const sentences = await draft('How does Matchium pick which questions to ask?');
    expect(sentences[0]?.sourceIds).toEqual(['matchium/half-the-questions']);
  });

  it('stays inside a project once the question names it', async () => {
    const sentences = await draft('How does Marauder handle backups?');
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence.sourceIds[0]).toMatch(/^marauder\//);
    }
  });

  it('finds experience in the CV', async () => {
    const sentences = await draft('Have you worked with Stripe payments?');
    expect(sentences[0]?.sourceIds[0]).toMatch(/^cv\/neurotime-ai-2026-07/);
  });

  it('says nothing rather than guess when nothing matches well enough', async () => {
    expect(await draft('What is your favourite colour?')).toEqual([]);
  });

  it('stops when the caller has gone', async () => {
    const abort = new AbortController();
    abort.abort();
    const sentences: DraftSentence[] = [];
    for await (const sentence of engine.answer('Matchium questions', abort.signal)) {
      sentences.push(sentence);
    }
    expect(sentences).toEqual([]);
  });
});

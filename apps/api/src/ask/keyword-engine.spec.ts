import { answerMaxLength } from '@portfolio/content/ask';
import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../../test/content.fixture.js';
import type { DraftSentence } from './answer-engine.js';
import { KeywordAnswerEngine, tokenize } from './keyword-engine.js';
import { Knowledge, buildKnowledge, type KnowledgeDocument } from './knowledge.js';

const knowledge = buildKnowledge(fixtureContent);
const engine = new KeywordAnswerEngine(knowledge);

async function draft(question: string, from = engine): Promise<DraftSentence[]> {
  const sentences: DraftSentence[] = [];
  let characters = 0;
  const roomLeft = () => answerMaxLength - characters;
  for await (const sentence of from.answer(question, new AbortController().signal, roomLeft)) {
    sentences.push(sentence);
    characters += sentence.text.length;
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
  it('answers from the fact that matches, or a passage backed by it, and cites it', async () => {
    const sentences = await draft('How does Tuner pick which questions to ask?');
    const cited = sentences[0]?.sourceIds[0] ?? '';
    const backs = knowledge.get(cited)?.backs ?? [];
    expect(cited === 'tuner/fewer-questions' || backs.includes('tuner/fewer-questions')).toBe(true);
  });

  it('stays inside a project once the question names it', async () => {
    const sentences = await draft('How does Courier handle requests?');
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence.sourceIds[0]).toMatch(/^courier\//);
    }
  });

  it('finds experience in the CV', async () => {
    const sentences = await draft('Have you worked with Stripe payments?');
    expect(sentences[0]?.sourceIds[0]).toBe('cv/northwind-2024-01/1');
  });

  it('skips a sentence that would not fit the rest of the answer and takes the next one that does', async () => {
    const relayFact = (slug: string, text: string): KnowledgeDocument => ({
      id: `relay/${slug}`,
      kind: 'fact',
      project: 'relay',
      text,
      keywords: '',
      source: { id: `relay/${slug}`, label: 'Relay' },
    });
    const withRelay = new Knowledge(
      [
        ...knowledge.documents,
        relayFact('batches', 'Relay batches writes.'),
        relayFact('groups', 'Relay batches writes in small groups.'),
        relayFact('long', `Relay batches writes. ${'x'.repeat(answerMaxLength - 30)}`),
      ],
      new Map([...knowledge.projectNames, ['relay', 'Relay']]),
    );
    const sentences = await draft(
      'How does Relay batch writes?',
      new KeywordAnswerEngine(withRelay),
    );
    expect(sentences.map((sentence) => sentence.sourceIds)).toEqual([
      ['relay/batches'],
      ['relay/groups'],
    ]);
  });

  it('says nothing rather than guess when nothing matches well enough', async () => {
    expect(await draft('What is your favourite colour?')).toEqual([]);
  });

  it('stops when the caller has gone', async () => {
    const abort = new AbortController();
    abort.abort();
    const sentences: DraftSentence[] = [];
    for await (const sentence of engine.answer(
      'Tuner questions',
      abort.signal,
      () => answerMaxLength,
    )) {
      sentences.push(sentence);
    }
    expect(sentences).toEqual([]);
  });
});

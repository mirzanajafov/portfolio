import { describe, expect, it } from 'vitest';
import type { AnswerEngine, DraftSentence } from './answer-engine.js';
import { AskService, refusal, type AskEvent } from './ask.service.js';
import { Knowledge } from './knowledge.js';

const knowledge = new Knowledge(
  [
    {
      id: 'demo/fast',
      project: 'demo',
      text: 'It answers in 40 ms.',
      keywords: 'demo',
      source: { id: 'demo/fast', label: 'Demo · README.md' },
    },
  ],
  new Map([['demo', 'Demo']]),
);

function engineSaying(...drafts: DraftSentence[]): AnswerEngine {
  return {
    name: 'stub',
    async *answer() {
      yield* drafts;
    },
  };
}

async function collect(service: AskService, question = 'How fast is it?'): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const event of service.ask(question, new AbortController().signal)) {
    events.push(event);
  }
  return events;
}

describe('AskService', () => {
  it('streams sourced sentences between a meta event and a done event', async () => {
    const service = new AskService(
      engineSaying({ text: 'It answers in 40 ms.', sourceIds: ['demo/fast'] }),
      knowledge,
      'me@example.com',
    );
    expect(await collect(service)).toEqual([
      { type: 'meta', engine: 'stub' },
      {
        type: 'sentence',
        text: 'It answers in 40 ms.',
        sources: [{ id: 'demo/fast', label: 'Demo · README.md' }],
      },
      { type: 'done' },
    ]);
  });

  it('treats a citation of a document that does not exist as no citation at all', async () => {
    const service = new AskService(
      engineSaying({ text: 'It won an award.', sourceIds: ['demo/fast', 'demo/invented'] }),
      knowledge,
      'me@example.com',
    );
    const events = await collect(service);
    expect(events).toContainEqual({ type: 'withheld', reason: 'unsupported' });
    expect(events).not.toContainEqual(expect.objectContaining({ text: 'It won an award.' }));
  });

  it('falls back to a fixed refusal when every sentence was withheld', async () => {
    const service = new AskService(
      engineSaying({ text: 'Unsourced claim.', sourceIds: [] }),
      knowledge,
      'me@example.com',
    );
    const events = await collect(service);
    expect(events.at(-2)).toEqual({
      type: 'sentence',
      text: refusal('me@example.com'),
      sources: [],
    });
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('refuses when the engine has nothing to say', async () => {
    const service = new AskService(engineSaying(), knowledge, 'me@example.com');
    const sentences = (await collect(service)).filter((event) => event.type === 'sentence');
    expect(sentences).toEqual([{ type: 'sentence', text: refusal('me@example.com'), sources: [] }]);
  });
});

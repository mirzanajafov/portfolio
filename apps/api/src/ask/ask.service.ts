import { Inject, Injectable } from '@nestjs/common';
import { ANSWER_ENGINE, type AnswerEngine } from './answer-engine.js';
import { Knowledge, type Source } from './knowledge.js';
import { gateSentence, type GateReason } from './sentence-gate.js';

export const CONTACT_EMAIL = Symbol('CONTACT_EMAIL');

export type AskEvent =
  | { type: 'meta'; engine: string }
  | { type: 'sentence'; text: string; sources: Source[] }
  | { type: 'withheld'; reason: GateReason }
  | { type: 'done' };

export type AskOutcome = {
  engine: string;
  sentences: { text: string; sources: string[] }[];
  withheld: GateReason[];
  refused: boolean;
};

@Injectable()
export class AskService {
  constructor(
    @Inject(ANSWER_ENGINE) private readonly engine: AnswerEngine,
    private readonly knowledge: Knowledge,
    @Inject(CONTACT_EMAIL) private readonly email: string,
  ) {}

  get engineName(): string {
    return this.engine.name;
  }

  answer(
    question: string,
    signal: AbortSignal,
  ): { events: AsyncIterable<AskEvent>; outcome: AskOutcome } {
    const outcome: AskOutcome = {
      engine: this.engine.name,
      sentences: [],
      withheld: [],
      refused: true,
    };
    return { events: this.events(question, signal, outcome), outcome };
  }

  private async *events(
    question: string,
    signal: AbortSignal,
    outcome: AskOutcome,
  ): AsyncIterable<AskEvent> {
    yield { type: 'meta', engine: outcome.engine };
    let characters = 0;
    for await (const draft of this.engine.answer(question, signal)) {
      const sources = draft.sourceIds
        .map((id) => this.knowledge.get(id)?.source)
        .filter((source): source is Source => source !== undefined);
      const sourceCount = sources.length === draft.sourceIds.length ? sources.length : 0;
      const verdict = gateSentence({ text: draft.text, sourceCount }, question, characters);
      if (!verdict.ok) {
        outcome.withheld.push(verdict.reason);
        yield { type: 'withheld', reason: verdict.reason };
        continue;
      }
      characters += verdict.text.length;
      outcome.refused = false;
      outcome.sentences.push({ text: verdict.text, sources: sources.map((source) => source.id) });
      yield { type: 'sentence', text: verdict.text, sources };
    }
    if (outcome.refused && !signal.aborted) {
      const text = `I don't have a source for that, so I won't guess. Ask me directly at ${this.email}.`;
      outcome.sentences.push({ text, sources: [] });
      yield { type: 'sentence', text, sources: [] };
    }
    yield { type: 'done' };
  }
}

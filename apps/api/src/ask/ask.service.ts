import { Inject, Injectable } from '@nestjs/common';
import { ANSWER_ENGINE, type AnswerEngine } from './answer-engine.js';
import { Knowledge, type Source } from './knowledge.js';
import { gateSentence, type GateReason } from './sentence-gate.js';

export type AskEvent =
  | { type: 'meta'; engine: string }
  | { type: 'sentence'; text: string; sources: Source[] }
  | { type: 'withheld'; reason: GateReason }
  | { type: 'done' };

export function refusal(email: string): string {
  return `I don't have a source for that, so I won't guess. Ask me directly at ${email}.`;
}

@Injectable()
export class AskService {
  constructor(
    @Inject(ANSWER_ENGINE) private readonly engine: AnswerEngine,
    private readonly knowledge: Knowledge,
    @Inject('CONTACT_EMAIL') private readonly email: string,
  ) {}

  async *ask(question: string, signal: AbortSignal): AsyncIterable<AskEvent> {
    yield { type: 'meta', engine: this.engine.name };
    let characters = 0;
    let answered = false;
    for await (const draft of this.engine.answer(question, signal)) {
      const sources = draft.sourceIds
        .map((id) => this.knowledge.get(id)?.source)
        .filter((source): source is Source => source !== undefined);
      const sourceCount = sources.length === draft.sourceIds.length ? sources.length : 0;
      const verdict = gateSentence(
        { text: draft.text, sourceCount, fixed: draft.fixed },
        question,
        characters,
      );
      if (!verdict.ok) {
        yield { type: 'withheld', reason: verdict.reason };
        continue;
      }
      characters += verdict.text.length;
      answered = true;
      yield { type: 'sentence', text: verdict.text, sources };
    }
    if (!answered && !signal.aborted) {
      yield { type: 'sentence', text: refusal(this.email), sources: [] };
    }
    yield { type: 'done' };
  }
}

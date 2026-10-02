export type DraftSentence = {
  text: string;
  sourceIds: string[];
  fixed?: boolean;
};

export interface AnswerEngine {
  readonly name: string;
  answer(question: string, signal: AbortSignal): AsyncIterable<DraftSentence>;
}

export const ANSWER_ENGINE = Symbol('ANSWER_ENGINE');

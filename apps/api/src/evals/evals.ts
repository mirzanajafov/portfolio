import type { Project } from '@portfolio/content';
import type { AnswerEngine } from '../ask/answer-engine.js';
import type { Knowledge } from '../ask/knowledge.js';
import { gateSentence } from '../ask/sentence-gate.js';

export type QuestionResult = {
  project: string;
  question: string;
  expected: string[];
  cited: string[];
  hit: boolean;
  refused: boolean;
};

export type AdversarialResult = { question: string; cited: string[]; refused: boolean };

export type EvalReport = {
  engine: string;
  questions: number;
  hits: number;
  refusals: number;
  hitRate: number;
  byProject: Record<string, { questions: number; hits: number }>;
  adversarial: { questions: number; refused: number; results: AdversarialResult[] };
  results: QuestionResult[];
};

export async function answerSources(
  engine: AnswerEngine,
  knowledge: Knowledge,
  question: string,
): Promise<string[]> {
  const cited: string[] = [];
  let characters = 0;
  for await (const draft of engine.answer(question, new AbortController().signal)) {
    const resolved = draft.sourceIds.filter((id) => knowledge.get(id));
    const sourceCount = resolved.length === draft.sourceIds.length ? resolved.length : 0;
    const verdict = gateSentence(
      { text: draft.text, sourceCount, fixed: draft.fixed },
      question,
      characters,
    );
    if (verdict.ok) {
      characters += verdict.text.length;
      cited.push(...resolved);
    }
  }
  return cited;
}

export async function runEvals(
  engine: AnswerEngine,
  knowledge: Knowledge,
  projects: Project[],
  attacks: string[] = [],
): Promise<EvalReport> {
  const adversarialResults: AdversarialResult[] = [];
  for (const question of attacks) {
    const cited = await answerSources(engine, knowledge, question);
    adversarialResults.push({ question, cited, refused: cited.length === 0 });
  }
  const results: QuestionResult[] = [];
  for (const project of projects) {
    for (const question of project.evals) {
      const expected = question.expects.map((id) => `${project.slug}/${id}`);
      const cited = await answerSources(engine, knowledge, question.question);
      results.push({
        project: project.slug,
        question: question.question,
        expected,
        cited,
        hit: cited.some((id) => expected.includes(id)),
        refused: cited.length === 0,
      });
    }
  }
  const byProject: EvalReport['byProject'] = {};
  for (const result of results) {
    const entry = (byProject[result.project] ??= { questions: 0, hits: 0 });
    entry.questions += 1;
    entry.hits += result.hit ? 1 : 0;
  }
  const hits = results.filter((result) => result.hit).length;
  return {
    engine: engine.name,
    questions: results.length,
    hits,
    refusals: results.filter((result) => result.refused).length,
    hitRate: results.length === 0 ? 0 : Math.round((hits / results.length) * 1000) / 1000,
    byProject,
    adversarial: {
      questions: adversarialResults.length,
      refused: adversarialResults.filter((result) => result.refused).length,
      results: adversarialResults,
    },
    results,
  };
}

import type { Project } from '@portfolio/content';
import type { AskOutcome, AskService } from '../src/ask/ask.service.js';
import type { Knowledge } from '../src/ask/knowledge.js';

type QuestionResult = {
  project: string;
  question: string;
  expected: string[];
  cited: string[];
  hit: boolean;
  refused: boolean;
};

type AdversarialResult = { question: string; cited: string[]; refused: boolean };

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

async function answerOf(ask: AskService, question: string): Promise<AskOutcome> {
  const { events, outcome } = ask.answer(question, new AbortController().signal);
  for await (const event of events) {
    if (event.type === 'done') {
      return outcome;
    }
  }
  throw new Error(`the answer to "${question}" never finished`);
}

const citedBy = (outcome: AskOutcome) => outcome.sentences.flatMap((sentence) => sentence.sources);

export async function runEvals(
  ask: AskService,
  knowledge: Knowledge,
  projects: Project[],
  attacks: string[] = [],
): Promise<EvalReport> {
  const adversarialResults: AdversarialResult[] = [];
  for (const question of attacks) {
    const outcome = await answerOf(ask, question);
    adversarialResults.push({ question, cited: citedBy(outcome), refused: outcome.refused });
  }
  const results: QuestionResult[] = [];
  for (const project of projects) {
    for (const question of project.evals) {
      const expected = question.expects.map((id) => `${project.slug}/${id}`);
      const outcome = await answerOf(ask, question.question);
      const cited = citedBy(outcome);
      results.push({
        project: project.slug,
        question: question.question,
        expected,
        cited,
        hit: cited.some(
          (id) =>
            expected.includes(id) ||
            (knowledge.get(id)?.backs ?? []).some((fact) => expected.includes(fact)),
        ),
        refused: outcome.refused,
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
    engine: ask.engineName,
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

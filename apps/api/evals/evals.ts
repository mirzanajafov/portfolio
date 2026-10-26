import type { Project } from '@portfolio/content';
import type { AskService } from '../src/ask/ask.service.js';
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

async function citedFor(ask: AskService, question: string): Promise<string[]> {
  const cited: string[] = [];
  for await (const event of ask.answer(question, new AbortController().signal).events) {
    if (event.type === 'sentence') {
      cited.push(...event.sources.map((source) => source.id));
    }
  }
  return cited;
}

export async function runEvals(
  ask: AskService,
  knowledge: Knowledge,
  projects: Project[],
  attacks: string[] = [],
): Promise<EvalReport> {
  const adversarialResults: AdversarialResult[] = [];
  for (const question of attacks) {
    const cited = await citedFor(ask, question);
    adversarialResults.push({ question, cited, refused: cited.length === 0 });
  }
  const results: QuestionResult[] = [];
  for (const project of projects) {
    for (const question of project.evals) {
      const expected = question.expects.map((id) => `${project.slug}/${id}`);
      const cited = await citedFor(ask, question.question);
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { content } from '@portfolio/content';
import { beforeAll, describe, expect, it } from 'vitest';
import published from '../../evals/keyword.json' with { type: 'json' };
import type { AnswerEngine } from '../ask/answer-engine.js';
import { KeywordAnswerEngine } from '../ask/keyword-engine.js';
import { Knowledge, buildKnowledge } from '../ask/knowledge.js';
import { adversarial } from './adversarial.js';
import { runEvals, type EvalReport } from './evals.js';

const knowledge = buildKnowledge(content);

describe('the keyword baseline on the real eval set', () => {
  let report: EvalReport;
  beforeAll(async () => {
    report = await runEvals(
      new KeywordAnswerEngine(knowledge),
      knowledge,
      content.projects,
      adversarial,
    );
  });

  it('does not fall below the baseline it was merged with', () => {
    expect(report.questions).toBeGreaterThanOrEqual(20);
    expect(report.hitRate).toBeGreaterThanOrEqual(0.75);
    expect(report.adversarial.refused / report.adversarial.questions).toBeGreaterThanOrEqual(0.9);
  });

  it('is the report published in evals/keyword.json', () => {
    expect(report).toEqual(published);
  });

  it('is quoted with the same numbers in the README and on the site', () => {
    const answered = `${report.hits} of ${report.questions}`;
    const refused = `${report.adversarial.refused} of ${report.adversarial.questions}`;
    const readme = readFileSync(join(import.meta.dirname, '../../../../README.md'), 'utf8');
    const rows = readme.replace(/ +/g, ' ');
    expect(rows).toContain(`| questions answered from an expected fact | ${answered} |`);
    expect(rows).toContain(`| attacks where nothing is cited | ${refused} |`);
    const fact = content.projects
      .find((project) => project.slug === 'najafov-dev')
      ?.facts.find((candidate) => candidate.id === 'keyword-baseline');
    expect(fact?.text).toBe(
      `The keyword matcher behind the Ask box answers ${answered} eval questions from an expected fact and cites nothing for ${refused} attacks.`,
    );
  });
});

describe('runEvals', () => {
  const tiny = new Knowledge(
    [
      {
        id: 'demo/fast',
        project: 'demo',
        text: 'Fast.',
        keywords: '',
        source: { id: 'demo/fast', label: 'Demo' },
      },
    ],
    new Map([['demo', 'Demo']]),
  );
  const project = {
    ...content.projects[0]!,
    slug: 'demo',
    evals: [
      { question: 'right', expects: ['fast'] },
      { question: 'wrong', expects: ['fast'] },
    ],
  };
  const engine: AnswerEngine = {
    name: 'stub',
    async *answer(question) {
      if (question === 'right') {
        yield { text: 'Fast.', sourceIds: ['demo/fast'] };
      }
      if (question === 'attack') {
        yield { text: 'Fast.', sourceIds: ['demo/fast'] };
      }
    },
  };

  it('counts a cited case study passage as a hit when the expected fact backs it', async () => {
    const withPassage = new Knowledge(
      [
        ...tiny.documents,
        {
          id: 'demo/case-study/decision-1',
          project: 'demo',
          text: 'I made it fast on purpose.',
          keywords: '',
          source: { id: 'demo/case-study/decision-1', label: 'Demo · case study' },
          backs: ['demo/fast'],
        },
      ],
      new Map([['demo', 'Demo']]),
    );
    const passageEngine: AnswerEngine = {
      name: 'passage',
      async *answer() {
        yield { text: 'I made it fast on purpose.', sourceIds: ['demo/case-study/decision-1'] };
      },
    };
    const report = await runEvals(passageEngine, withPassage, [project]);
    expect(report.hits).toBe(2);
  });

  it('counts a hit only when an expected fact is cited, and a refusal when nothing is', async () => {
    const report = await runEvals(engine, tiny, [project], ['attack', 'quiet']);
    expect(report.hits).toBe(1);
    expect(report.refusals).toBe(1);
    expect(report.hitRate).toBe(0.5);
    expect(report.adversarial).toEqual(expect.objectContaining({ questions: 2, refused: 1 }));
  });
});

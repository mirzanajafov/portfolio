import { content } from '@portfolio/content';
import { describe, expect, it } from 'vitest';
import type { AnswerEngine } from '../ask/answer-engine.js';
import { KeywordAnswerEngine } from '../ask/keyword-engine.js';
import { Knowledge, buildKnowledge } from '../ask/knowledge.js';
import { adversarial } from './adversarial.js';
import { runEvals } from './evals.js';

const knowledge = buildKnowledge(content);

describe('the keyword baseline on the real eval set', () => {
  it('does not fall below the baseline it was merged with', async () => {
    const report = await runEvals(
      new KeywordAnswerEngine(knowledge),
      knowledge,
      content.projects,
      adversarial,
    );
    expect(report.questions).toBeGreaterThanOrEqual(20);
    expect(report.hitRate).toBeGreaterThanOrEqual(0.75);
    expect(report.adversarial.refused / report.adversarial.questions).toBeGreaterThanOrEqual(0.9);
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

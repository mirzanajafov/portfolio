import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, type Project } from '@portfolio/content';
import { aProject, contentOf } from '@portfolio/content/testing';
import { assert, beforeAll, describe, expect, it } from 'vitest';
import type { AnswerEngine } from '../src/ask/answer-engine.js';
import { AskService } from '../src/ask/ask.service.js';
import { KeywordAnswerEngine } from '../src/ask/keyword-engine.js';
import { Knowledge, buildKnowledge } from '../src/ask/knowledge.js';
import { gateSentence } from '../src/ask/sentence-gate.js';
import { adversarial } from './adversarial.js';
import { answerOf, runEvals, type EvalReport } from './evals.js';
import published from './keyword.json' with { type: 'json' };

const knowledge = buildKnowledge(content);
const ask = new AskService(
  new KeywordAnswerEngine(knowledge),
  knowledge,
  content.profile.links.email,
);

describe('the keyword baseline on the real eval set', () => {
  let report: EvalReport;
  beforeAll(async () => {
    report = await runEvals(ask, knowledge, content.projects, adversarial);
  });

  it('does not fall below the baseline it was merged with', () => {
    expect(report.questions).toBeGreaterThanOrEqual(20);
    expect(report.hitRate).toBeGreaterThanOrEqual(0.75);
    expect(report.adversarial.refused / report.adversarial.questions).toBeGreaterThanOrEqual(0.9);
  });

  it('is the report published in evals/keyword.json', () => {
    expect(report).toEqual(published);
  });

  it('is quoted with the published numbers in the README and on the site', () => {
    const answered = `${published.hits} of ${published.questions}`;
    const refused = `${published.adversarial.refused} of ${published.adversarial.questions}`;
    const readme = readFileSync(join(import.meta.dirname, '..', '..', '..', 'README.md'), 'utf8');
    expect(readme).toContain(`plus ${published.adversarial.questions} attacks`);
    expect(readme).toContain(`| questions answered from an expected fact | ${answered} |`);
    expect(readme).toContain(`| attacks where nothing is cited | ${refused} |`);
    const fact = content.projects
      .find((project) => project.slug === 'najafov-dev')
      ?.facts.find((candidate) => candidate.id === 'keyword-baseline');
    expect(fact?.text).toContain(`answers ${answered} eval questions`);
    expect(fact?.text).toContain(`nothing for ${refused} attacks`);
  });

  it("follows the fact on PortalGun's 256 cap with the next one that fits, not the first decision that would not", async () => {
    const outcome = await answerOf(ask, 'Why does PortalGun refuse requests past 256 in flight?');
    expect(outcome).toMatchObject({
      sentences: [
        { sources: ['portalgun/admission-cap'] },
        { sources: ['portalgun/in-flight-memory'] },
      ],
      withheld: [],
    });
  });
});

describe('the knowledge built from the real content', () => {
  it('lets every document through the gate unchanged as the first sentence of an answer', () => {
    expect(
      knowledge.documents.map((document) => [
        document.id,
        gateSentence({ text: document.text, sourceCount: 1 }, '', 0),
      ]),
    ).toEqual(
      knowledge.documents.map((document) => [document.id, { ok: true, text: document.text }]),
    );
  });
});

describe('runEvals', () => {
  const answered = new Set(['right', 'also right', 'attack']);
  let project: Project;

  beforeAll(async () => {
    const [loaded] = (
      await contentOf({
        projects: [
          aProject({
            slug: 'demo',
            evals: [
              { question: 'right', expects: ['fast'] },
              { question: 'also right', expects: ['fast'] },
              { question: 'wrong', expects: ['fast'] },
              { question: 'also wrong', expects: ['fast'] },
            ],
          }),
        ],
      })
    ).projects;
    assert(loaded);
    project = loaded;
  });

  const tiny = new Knowledge(
    [
      {
        id: 'demo/fast',
        kind: 'fact',
        project: 'demo',
        text: 'Fast.',
        keywords: '',
        source: { id: 'demo/fast', label: 'Demo' },
      },
    ],
    new Map([['demo', 'Demo']]),
  );
  const engine: AnswerEngine = {
    name: 'stub',
    async *answer(question) {
      if (answered.has(question)) {
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
          kind: 'case-study',
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
    const report = await runEvals(
      new AskService(passageEngine, withPassage, 'me@example.com'),
      withPassage,
      [project],
    );
    expect(report.hits).toBe(4);
  });

  it('counts a hit only when an expected fact is cited, and a refusal when nothing is', async () => {
    const report = await runEvals(
      new AskService(engine, tiny, 'me@example.com'),
      tiny,
      [project],
      ['attack', 'quiet'],
    );
    expect(report.hits).toBe(2);
    expect(report.refusals).toBe(2);
    expect(report.hitRate).toBe(0.5);
    expect(report.adversarial).toEqual(expect.objectContaining({ questions: 2, refused: 1 }));
  });
});

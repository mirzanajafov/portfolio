import { aCaseStudy, aCv, aFact, aProject, aRole, someContent } from '@portfolio/content/testing';

const fewerQuestions = aFact({
  id: 'fewer-questions',
  text: 'Adaptive questions halve how many questions each user answers.',
  source: { file: 'README.md', href: 'https://github.com/someone/tuner/blob/main/README.md' },
});

const cancelLatency = aFact({
  id: 'cancel-latency',
  text: 'Cancelling a request reaches the worker in 6 ms.',
  source: { file: 'executor.ts' },
});

export const fixtureContent = someContent({
  projects: [
    aProject({
      slug: 'tuner',
      name: 'Tuner',
      hook: 'Matches people by asking fewer questions',
      summary: 'A matching service that picks the next question for each user.',
      headline: fewerQuestions,
      links: { live: 'https://tuner.example.com', repo: 'https://github.com/someone/tuner' },
      caseStudy: aCaseStudy({
        decisions: [
          {
            title: 'Pick the next question',
            body: 'The service picks the question that splits the remaining matches best.',
            facts: [fewerQuestions],
          },
          { title: 'Keep it small', body: 'One table holds the answers.', facts: [] },
        ],
      }),
    }),
    aProject({
      slug: 'courier',
      name: 'Courier',
      order: 2,
      hook: 'Keeps working offline',
      summary: 'A desktop client that queues requests while offline.',
      visibility: 'private',
      links: { live: 'https://courier.example.com' },
      knowledge: [],
      headline: cancelLatency,
    }),
  ],
  cv: aCv({
    experience: [
      aRole({
        company: 'Northwind',
        highlights: ['Built Stripe payments and refunds for the online shop.'],
      }),
    ],
  }),
});

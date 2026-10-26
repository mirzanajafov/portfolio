import { aCaseStudy, aCv, aFact, aProject, aRole, contentOf } from '@portfolio/content/testing';

export const fixtureContent = await contentOf({
  projects: [
    aProject({
      slug: 'tuner',
      name: 'Tuner',
      hook: 'Matches people by asking fewer questions',
      summary: 'A matching service that picks the next question for each user.',
      links: { live: 'https://tuner.example.com', repo: 'https://github.com/someone/tuner' },
      headline: 'fewer-questions',
      facts: [
        aFact({
          id: 'fewer-questions',
          text: 'Adaptive questions halve how many questions each user answers.',
          source: { file: 'README.md' },
        }),
      ],
      caseStudy: aCaseStudy({
        decisions: [
          {
            title: 'Pick the next question',
            body: 'The service picks the question that splits the remaining matches best.',
            facts: ['fewer-questions'],
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
      headline: 'cancel-latency',
      facts: [
        aFact({
          id: 'cancel-latency',
          text: 'Cancelling a request reaches the worker in 6 ms.',
          source: { file: 'executor.ts' },
        }),
      ],
    }),
    aProject({
      slug: 'gateway',
      name: 'Gateway',
      order: 3,
      hook: 'Routes traffic to the right service',
      summary: 'A proxy that handles every incoming request for the other services.',
      headline: 'retries',
      facts: [
        aFact({
          id: 'retries',
          text: 'It handles every request and retries failed requests twice.',
          source: { file: 'README.md' },
        }),
      ],
    }),
  ],
  cv: aCv({
    experience: [
      aRole({
        company: 'Northwind',
        from: '2024-01',
        highlights: ['Built Stripe payments and refunds for the online shop.'],
      }),
    ],
  }),
});

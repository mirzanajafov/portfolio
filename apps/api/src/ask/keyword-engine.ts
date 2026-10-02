import type { AnswerEngine, DraftSentence } from './answer-engine.js';
import type { Knowledge, KnowledgeDocument } from './knowledge.js';

const stopwords = new Set(
  (
    'a an and are as at be been being but by can could did do does doing for from had has have ' +
    'how i if in into is it its just me my of on or so than that the their them then there ' +
    'these they this those to was we were what when where which while who whom whose why will ' +
    'with would you your yours about tell much many any some more most also very after before ' +
    'again each every say says said only not no yes all here out up down over under other such ' +
    'own same both few should may might must shall am he she him her his our us get got'
  ).split(' '),
);

function stem(word: string): string {
  const trimmed = word.replace(/^[.+#-]+|[.-]+$/g, '');
  if (/[.\d]/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length > 6 && trimmed.endsWith('ing')) {
    return trimmed.slice(0, -3);
  }
  if (trimmed.length > 5 && trimmed.endsWith('ed')) {
    return trimmed.slice(0, -2);
  }
  if (trimmed.length > 4 && trimmed.endsWith('ies')) {
    return `${trimmed.slice(0, -3)}y`;
  }
  if (/(ch|sh|x|ss)es$/.test(trimmed)) {
    return trimmed.slice(0, -2);
  }
  if (trimmed.length > 3 && trimmed.endsWith('s') && !trimmed.endsWith('ss')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.+#-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => !stopwords.has(word))
    .map(stem)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

type Indexed = {
  document: KnowledgeDocument;
  frequency: Map<string, number>;
  length: number;
};

export type KeywordOptions = {
  k1: number;
  b: number;
  keywordWeight: number;
  summaryWeight: number;
  minScore: number;
  minMatchedTerms: number;
  relative: number;
  maxSentences: number;
};

export const defaultKeywordOptions: KeywordOptions = {
  k1: 1.2,
  b: 0.75,
  keywordWeight: 0.5,
  summaryWeight: 0.5,
  minScore: 2.5,
  minMatchedTerms: 2,
  relative: 0.6,
  maxSentences: 2,
};

type Ranked = { document: KnowledgeDocument; score: number; matched: number };

export class KeywordAnswerEngine implements AnswerEngine {
  readonly name = 'keyword';
  private readonly indexed: Indexed[];
  private readonly idf: Map<string, number>;
  private readonly averageLength: number;

  constructor(
    private readonly knowledge: Knowledge,
    private readonly options: KeywordOptions = defaultKeywordOptions,
  ) {
    this.indexed = knowledge.documents.map((document) => {
      const frequency = new Map<string, number>();
      const text = tokenize(document.text);
      for (const token of text) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
      }
      for (const token of new Set(tokenize(document.keywords))) {
        if (!frequency.has(token)) {
          frequency.set(token, options.keywordWeight);
        }
      }
      return { document, frequency, length: text.length };
    });
    const counts = new Map<string, number>();
    for (const { frequency } of this.indexed) {
      for (const token of frequency.keys()) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    const total = this.indexed.length;
    this.idf = new Map(
      [...counts].map(([token, count]) => [
        token,
        Math.log(1 + (total - count + 0.5) / (count + 0.5)),
      ]),
    );
    this.averageLength =
      this.indexed.reduce((sum, entry) => sum + entry.length, 0) / Math.max(1, total);
  }

  private mentionedProjects(tokens: Set<string>): Set<string> {
    const mentioned = new Set<string>();
    for (const [slug, name] of this.knowledge.projectNames) {
      const nameTokens = tokenize(name);
      if (nameTokens.length > 0 && nameTokens.every((token) => tokens.has(token))) {
        mentioned.add(slug);
      }
    }
    return mentioned;
  }

  rank(question: string): Ranked[] {
    const query = new Set(tokenize(question));
    const projects = this.mentionedProjects(query);
    const { k1, b, summaryWeight } = this.options;
    return this.indexed
      .filter(
        ({ document }) =>
          projects.size === 0 || (document.project && projects.has(document.project)),
      )
      .map(({ document, frequency, length }) => {
        let score = 0;
        let matched = 0;
        for (const token of query) {
          const tf = frequency.get(token);
          if (!tf) {
            continue;
          }
          matched += 1;
          const norm = tf + k1 * (1 - b + (b * length) / this.averageLength);
          score += ((this.idf.get(token) ?? 0) * (tf * (k1 + 1))) / norm;
        }
        if (document.id.endsWith('/summary')) {
          score *= summaryWeight;
        }
        return { document, score, matched };
      })
      .filter(({ score }) => score > 0)
      .sort((x, y) => y.score - x.score);
  }

  choose(question: string): KnowledgeDocument[] {
    const terms = new Set(tokenize(question)).size;
    const needed = Math.min(this.options.minMatchedTerms, terms);
    const ranked = this.rank(question).filter(({ matched }) => matched >= needed);
    const top = ranked[0];
    if (!top || top.score < this.options.minScore) {
      return [];
    }
    const subject = top.document.project ?? 'about-me';
    return ranked
      .filter(({ document }) => (document.project ?? 'about-me') === subject)
      .filter(({ score }) => score >= top.score * this.options.relative)
      .slice(0, this.options.maxSentences)
      .map(({ document }) => document);
  }

  async *answer(question: string, signal: AbortSignal): AsyncIterable<DraftSentence> {
    for (const document of this.choose(question)) {
      if (signal.aborted) {
        return;
      }
      yield { text: document.text, sourceIds: [document.id] };
    }
  }
}

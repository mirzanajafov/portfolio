'use client';

import { useRef, useState, type FormEvent } from 'react';
import { readEvents, type AskSource } from '@/lib/ask-events';
import { AskFailure, failureMessage } from '@/lib/ask-failure';

type Sentence = { text: string; sources: AskSource[] };

type State =
  | { status: 'idle' }
  | { status: 'asking' | 'done'; asked: string; sentences: Sentence[] }
  | { status: 'error'; asked: string; sentences: Sentence[]; message: string };

export function Ask({
  suggestions,
  email,
  retentionDays = 30,
}: {
  suggestions: string[];
  email: string;
  retentionDays?: number;
}) {
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const current = useRef<AbortController | null>(null);

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked) {
      return;
    }
    current.current?.abort();
    const abort = new AbortController();
    current.current = abort;
    setState({ status: 'asking', asked, sentences: [] });
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: asked }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) {
        throw new AskFailure(
          failureMessage(response.status, response.headers.get('retry-after'), email),
        );
      }
      for await (const event of readEvents(response.body)) {
        if (event.type === 'sentence') {
          const sentence = { text: event.text, sources: event.sources };
          setState((previous) =>
            previous.status === 'asking'
              ? { ...previous, sentences: [...previous.sentences, sentence] }
              : previous,
          );
        }
      }
      setState((previous) =>
        previous.status === 'asking' ? { ...previous, status: 'done' } : previous,
      );
    } catch (error) {
      if (abort.signal.aborted) {
        return;
      }
      const message = error instanceof AskFailure ? error.message : failureMessage(0, null, email);
      setState((previous) =>
        previous.status === 'idle'
          ? previous
          : { status: 'error', asked: previous.asked, sentences: previous.sentences, message },
      );
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section aria-labelledby="ask" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="ask" className="text-3xl font-semibold tracking-tight">
          Ask about me
        </h2>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Answers come only from my CV and my project notes, with the source under every sentence,
          and it says so when it doesn&apos;t know. For now a keyword matcher picks the sentences; a
          language model and my own voice come later.
        </p>
        <p className="max-w-2xl text-xs text-[var(--muted)]">
          I keep questions for {retentionDays} days to see where the answers fail, then they are
          deleted. Your IP address is never stored, only a keyed hash that changes every day and is
          used for rate limiting.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <input
          id="question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="How does Matchium decide which questions to ask?"
          className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-transparent px-5 py-3 outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={state.status === 'asking' || question.trim() === ''}
          className="rounded-full bg-[var(--fg)] px-6 py-3 text-[var(--bg)] disabled:opacity-50"
        >
          {state.status === 'asking' ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {state.status === 'idle' && (
        <ul aria-label="Questions you could ask" className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  void ask(suggestion);
                }}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-left text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite" className="flex flex-col gap-4">
        {state.status !== 'idle' && (
          <>
            <p className="text-sm text-[var(--muted)]">You asked: {state.asked}</p>
            {state.sentences.map((sentence, index) => (
              <div key={index} className="flex flex-col gap-1">
                <p className="text-lg leading-relaxed">{sentence.text}</p>
                {sentence.sources.length > 0 && (
                  <p className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span>Source:</span>
                    {sentence.sources.map((source) =>
                      source.href ? (
                        <a
                          key={source.id}
                          href={source.href}
                          className="underline underline-offset-4"
                        >
                          {source.label}
                        </a>
                      ) : (
                        <span key={source.id}>{source.label} (private repo)</span>
                      ),
                    )}
                  </p>
                )}
              </div>
            ))}
            {state.status === 'error' && <p role="alert">{state.message}</p>}
          </>
        )}
      </div>
    </section>
  );
}

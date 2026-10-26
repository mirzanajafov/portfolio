'use client';

import { askLogDays, questionMaxLength, type AskSource } from '@portfolio/content/ask';
import { useRef, useState, type SubmitEvent } from 'react';
import { readEvents } from './events';
import { AskFailure, failureMessage } from './failure';

type Sentence = { text: string; sources: AskSource[] };

type State =
  | { status: 'idle' }
  | { status: 'asking' | 'done'; asked: string; sentences: Sentence[] }
  | { status: 'error'; asked: string; sentences: Sentence[]; message: string };

export function Ask({ suggestions, email }: { suggestions: string[]; email: string }) {
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
      let finished = false;
      for await (const event of readEvents(response.body)) {
        finished = event.type === 'done';
        if (event.type === 'sentence') {
          const sentence = { text: event.text, sources: event.sources };
          setState((previous) =>
            previous.status === 'asking'
              ? { ...previous, sentences: [...previous.sentences, sentence] }
              : previous,
          );
        }
      }
      if (!finished) {
        throw new AskFailure(failureMessage(0, null, email));
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

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section aria-labelledby="ask" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="ask" className="text-3xl font-semibold tracking-tight">
          Ask about me
        </h2>
        <p className="max-w-2xl text-sm text-muted">
          Answers come only from my CV and my project notes, with the source under every sentence,
          and it says so when it doesn&apos;t know. For now a keyword matcher picks the sentences,
          and a language model and my own voice come later.
        </p>
        <p className="max-w-2xl text-xs text-muted">
          I keep questions for {askLogDays} days to see where the answers fail, then they are
          deleted. Your IP address is never stored, only a keyed hash that changes every day and is
          used for rate limiting.
        </p>
      </div>
      <form onSubmit={submit} className="flex max-w-3xl gap-2 sm:gap-3">
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <input
          id="question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={questionMaxLength}
          autoComplete="off"
          placeholder="Ask about my work"
          className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-5 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={state.status === 'asking' || question.trim() === ''}
          className="shrink-0 rounded-full bg-fg px-5 py-3 text-bg disabled:opacity-50 sm:px-6"
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
                className="rounded-full border border-line px-3 py-1.5 text-left text-sm text-muted hover:border-accent hover:text-fg"
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
            <p className="text-sm text-muted">You asked: {state.asked}</p>
            {state.sentences.map((sentence, index) => (
              <div key={index} className="flex flex-col gap-1">
                <p className="text-lg leading-relaxed">{sentence.text}</p>
                {sentence.sources.length > 0 && (
                  <p className="flex flex-wrap gap-2 text-xs text-muted">
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

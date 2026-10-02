import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ask } from './ask';

function sse(...events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Ask', () => {
  it('shows each sentence with a link to its source, and marks private sources as private', async () => {
    const fetchMock = vi.fn(async () =>
      sse(
        { type: 'meta', engine: 'keyword' },
        {
          type: 'sentence',
          text: 'Adaptive questions halve the count.',
          sources: [{ id: 'm/a', label: 'Matchium · README.md', href: 'https://github.com/x' }],
        },
        {
          type: 'sentence',
          text: 'Cancel lands in 6 ms.',
          sources: [{ id: 't/c', label: 'TM Post · executor.ts' }],
        },
        { type: 'done' },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<Ask suggestions={[]} email="me@example.com" />);

    await userEvent.type(screen.getByLabelText('Your question'), 'How does Matchium work?');
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('Adaptive questions halve the count.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Matchium · README.md' })).toHaveAttribute(
      'href',
      'https://github.com/x',
    );
    expect(screen.getByText('TM Post · executor.ts (private repo)')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ask',
      expect.objectContaining({ body: JSON.stringify({ question: 'How does Matchium work?' }) }),
    );
  });

  it('asks a suggested question with one click', async () => {
    const fetchMock = vi.fn(async () => sse({ type: 'done' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Ask suggestions={['How do you back it up?']} email="me@example.com" />);

    await userEvent.click(screen.getByRole('button', { name: 'How do you back it up?' }));

    expect(await screen.findByText('You asked: How do you back it up?')).toBeInTheDocument();
  });

  it('says when to come back after hitting the rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } })),
    );
    render(<Ask suggestions={[]} email="me@example.com" />);

    await userEvent.type(screen.getByLabelText('Your question'), 'Again?');
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 2 minutes');
  });

  it('points to email when the service is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    render(<Ask suggestions={[]} email="me@example.com" />);

    await userEvent.type(screen.getByLabelText('Your question'), 'Anything?');
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email me at me@example.com');
  });
});

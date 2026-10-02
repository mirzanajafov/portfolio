import { describe, expect, it, vi } from 'vitest';
import { forwardAsk } from './forward-ask';

const ask = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://site/api/ask', { method: 'POST', body, headers });

describe('forwardAsk', () => {
  it('passes the question and the caller address to the API and streams the answer back', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('data: {}\n\n', { status: 200 }),
    );
    const response = await forwardAsk(
      ask('{"question":"hi"}', { 'x-forwarded-for': '203.0.113.7' }),
      'http://api:3201',
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/ask',
      expect.objectContaining({
        method: 'POST',
        body: '{"question":"hi"}',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(await response.text()).toBe('data: {}\n\n');
  });

  it('refuses an oversized body without bothering the API', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await forwardAsk(ask('x'.repeat(2_001)), 'http://api', fetchImpl);
    expect(response.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('says the service is unreachable when the API is down', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await forwardAsk(ask('{}'), 'http://api', fetchImpl)).status).toBe(503);
  });

  it('passes a rate limit through with the time to wait', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '420' } }),
    );
    const response = await forwardAsk(ask('{}'), 'http://api', fetchImpl);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('420');
  });

  it('keeps a validation error a validation error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{}', { status: 400 }));
    expect((await forwardAsk(ask('{}'), 'http://api', fetchImpl)).status).toBe(400);
  });
});

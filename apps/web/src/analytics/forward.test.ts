import { describe, expect, it, vi } from 'vitest';
import { forwardEvent } from './forward';

const event = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://site/api/events', { method: 'POST', body, headers });

describe('forwardEvent', () => {
  it('passes the event, the caller address, the browser and its privacy signals to the API', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const response = await forwardEvent(
      event('{"type":"view"}', {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Chrome',
        'sec-gpc': '1',
        dnt: '1',
        cookie: 'unrelated=1',
      }),
      'http://api:3201',
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith('http://api:3201/events', {
      method: 'POST',
      body: '{"type":"view"}',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Chrome',
        'sec-gpc': '1',
        dnt: '1',
      },
    });
    expect(response.status).toBe(204);
  });

  it('refuses an oversized body without bothering the API', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await forwardEvent(event('x'.repeat(2_001)), 'http://api', fetchImpl);
    expect(response.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('says the service is unreachable when the API is down', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await forwardEvent(event('{}'), 'http://api', fetchImpl)).status).toBe(503);
  });

  it('passes a rejected event and a rate limit through, with only the time to wait', async () => {
    const refused = vi.fn<typeof fetch>(
      async () => new Response('{"message":"x"}', { status: 400 }),
    );
    const limited = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '420' } }),
    );
    expect((await forwardEvent(event('{}'), 'http://api', refused)).status).toBe(400);
    const response = await forwardEvent(event('{}'), 'http://api', limited);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('420');
    expect(await response.text()).toBe('');
  });

  it('turns any other failure of the API into a bad gateway', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
    expect((await forwardEvent(event('{}'), 'http://api', fetchImpl)).status).toBe(502);
  });
});

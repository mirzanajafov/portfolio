import { describe, expect, it, vi } from 'vitest';
import { forwardEvent } from './forward';

describe('forwardEvent', () => {
  it('passes the event, the caller address, the browser, its privacy signals and the origin, and finishes on its own clock even if the visitor has gone', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const request = new Request('http://site/api/events', {
      method: 'POST',
      body: '{"type":"view"}',
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Chrome',
        'sec-gpc': '1',
        dnt: '1',
        origin: 'https://najafov.dev',
        cookie: 'unrelated=1',
      },
    });
    const response = await forwardEvent(request, 'http://api:3201', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api:3201/events',
      expect.objectContaining({
        body: '{"type":"view"}',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.7',
          'user-agent': 'Chrome',
          'sec-gpc': '1',
          dnt: '1',
          origin: 'https://najafov.dev',
        },
      }),
    );
    expect(response.status).toBe(204);
    const signal = fetchImpl.mock.calls[0]?.[1]?.signal;
    expect(signal).not.toBe(request.signal);
    expect(signal?.aborted).toBe(false);
  });

  it('answers an invalid event from another site with a bare 400 that no page there can read', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{"m":"x"}', { status: 400 }));
    const request = new Request('http://site/api/events', {
      method: 'POST',
      body: '{"type":"view"}',
      headers: { origin: 'https://example.com' },
    });
    const response = await forwardEvent(request, 'http://api:3201', fetchImpl);
    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(await response.text()).toBe('');
  });
});

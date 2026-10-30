import { describe, expect, it, vi } from 'vitest';
import { forwardEvent } from './forward';

describe('forwardEvent', () => {
  it('passes the event, the caller address, the browser and its privacy signals, and answers with no content', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const request = new Request('http://site/api/events', {
      method: 'POST',
      body: '{"type":"view"}',
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Chrome',
        'sec-gpc': '1',
        dnt: '1',
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
        },
      }),
    );
    expect(response.status).toBe(204);
  });
});

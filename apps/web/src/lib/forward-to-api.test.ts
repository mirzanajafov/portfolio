import { describe, expect, it, vi } from 'vitest';
import { forwardToApi } from './forward-to-api';

const ok = () => new Response('done', { status: 200 });

function post(body: BodyInit, headers: Record<string, string> = {}) {
  const init: RequestInit & { duplex: 'half' } = { method: 'POST', body, headers, duplex: 'half' };
  return new Request('http://site/api/x', init);
}

function forward(request: Request, fetchImpl: typeof fetch) {
  return forwardToApi(
    request,
    { url: 'http://api/x', headers: ['x-forwarded-for'], fetchImpl },
    ok,
  );
}

describe('forwardToApi', () => {
  it('posts the body as JSON with only the headers it was told to pass, and answers with the caller', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const response = await forward(
      post('{"a":1}', { 'x-forwarded-for': '203.0.113.7', cookie: 'secret=1' }),
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api/x',
      expect.objectContaining({
        method: 'POST',
        body: '{"a":1}',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      }),
    );
    expect(await response.text()).toBe('done');
  });

  it('refuses a body that says it is over 2,000 bytes without reading it', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await forward(post('{}', { 'content-length': '50000' }), fetchImpl);
    expect(response.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stops reading a body as soon as it passes 2,000 bytes, counting bytes and not characters', async () => {
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(500));
      },
    });
    const fetchImpl = vi.fn<typeof fetch>();
    expect((await forward(post(endless), fetchImpl)).status).toBe(413);
    expect(pulls).toBeLessThan(10);
    expect((await forward(post('é'.repeat(1_001)), fetchImpl)).status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('says the service is unreachable when the API is down', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await forward(post('{}'), fetchImpl)).status).toBe(503);
  });

  it('passes a refusal and a rate limit through, with only the time to wait', async () => {
    const refused = vi.fn<typeof fetch>(async () => new Response('{"m":"x"}', { status: 400 }));
    const limited = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '420' } }),
    );
    expect((await forward(post('{}'), refused)).status).toBe(400);
    const response = await forward(post('{}'), limited);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('420');
    expect(await response.text()).toBe('');
  });

  it('turns any other failure of the API into a bad gateway', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
    expect((await forward(post('{}'), fetchImpl)).status).toBe(502);
  });
});

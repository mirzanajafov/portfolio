const maxBody = 2_000;

export async function forwardAsk(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const body = await request.text();
  if (body.length > maxBody) {
    return new Response(null, { status: 413 });
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor;
  }
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${apiUrl}/ask`, {
      method: 'POST',
      headers,
      body,
      signal: request.signal,
    });
  } catch {
    return new Response(null, { status: 503 });
  }
  if (upstream.status === 400 || upstream.status === 429) {
    const retryAfter = upstream.headers.get('retry-after');
    return new Response(null, {
      status: upstream.status,
      headers: retryAfter ? { 'retry-after': retryAfter } : undefined,
    });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

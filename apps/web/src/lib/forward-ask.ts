const maxBody = 2_000;

export async function forwardAsk(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const body = await request.text();
  if (body.length > maxBody) {
    return Response.json({ message: 'question is too long' }, { status: 413 });
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
    return Response.json({ message: 'the answering service is not reachable' }, { status: 503 });
  }
  if (upstream.status === 400) {
    return Response.json({ message: 'question must be 1 to 300 characters' }, { status: 400 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ message: 'could not answer right now' }, { status: 502 });
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

const maxBody = 2_000;
const passedHeaders = ['x-forwarded-for', 'user-agent', 'sec-gpc', 'dnt'];

export async function forwardEvent(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const body = await request.text();
  if (body.length > maxBody) {
    return new Response(null, { status: 413 });
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  for (const name of passedHeaders) {
    const value = request.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${apiUrl}/events`, { method: 'POST', headers, body });
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
  return new Response(null, { status: upstream.ok ? 204 : 502 });
}

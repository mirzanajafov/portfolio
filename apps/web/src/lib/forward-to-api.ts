const maxBodyBytes = 2_000;

type Forward = { url: string; headers: readonly string[]; fetchImpl: typeof fetch };

export function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error('API_URL is not set, so the site has no API to forward to');
  }
  return url;
}

async function readCapped(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) {
    return null;
  }
  if (!request.body) {
    return '';
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function forwardToApi(
  request: Request,
  { url, headers: passed, fetchImpl }: Forward,
  respond: (upstream: Response) => Response,
): Promise<Response> {
  const body = await readCapped(request);
  if (body === null) {
    return new Response(null, { status: 413 });
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  for (const name of passed) {
    const value = request.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }
  let upstream: Response;
  try {
    upstream = await fetchImpl(url, { method: 'POST', headers, body, signal: request.signal });
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
  return upstream.ok ? respond(upstream) : new Response(null, { status: 502 });
}

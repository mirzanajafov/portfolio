import { content } from '@portfolio/content';
import { demoSites } from '@portfolio/content/analytics';
import { forwardToApi } from '@/lib/forward-to-api';

const demoOrigins = new Set(demoSites(content).keys());

export async function forwardEvent(
  request: Request,
  apiUrl: string,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const response = await forwardToApi(
    request,
    {
      url: `${apiUrl}/events`,
      fetchImpl,
      signal: AbortSignal.timeout(5_000),
      token,
    },
    () => new Response(null, { status: 204 }),
  );
  const origin = request.headers.get('origin');
  response.headers.set('vary', 'Origin');
  if (origin !== null && demoOrigins.has(origin)) {
    response.headers.set('access-control-allow-origin', origin);
  }
  return response;
}

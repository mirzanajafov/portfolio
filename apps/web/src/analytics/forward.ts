import { callerHeaders, forwardToApi } from '@/lib/forward-to-api';

const eventHeaders = [...callerHeaders, 'origin'];

export function forwardEvent(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return forwardToApi(
    request,
    {
      url: `${apiUrl}/events`,
      headers: eventHeaders,
      fetchImpl,
      signal: AbortSignal.timeout(5_000),
    },
    () => new Response(null, { status: 204 }),
  );
}

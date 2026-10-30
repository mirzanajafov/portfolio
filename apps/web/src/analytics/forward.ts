import { forwardToApi } from '@/lib/forward-to-api';

const passedHeaders = ['x-forwarded-for', 'user-agent', 'sec-gpc', 'dnt'];

export function forwardEvent(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return forwardToApi(
    request,
    { url: `${apiUrl}/events`, headers: passedHeaders, fetchImpl },
    () => new Response(null, { status: 204 }),
  );
}

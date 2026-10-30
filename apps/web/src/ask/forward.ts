import { forwardToApi } from '@/lib/forward-to-api';

export function forwardAsk(
  request: Request,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return forwardToApi(
    request,
    { url: `${apiUrl}/ask`, headers: ['x-forwarded-for'], fetchImpl, signal: request.signal },
    (upstream) =>
      upstream.body
        ? new Response(upstream.body, {
            status: 200,
            headers: {
              'content-type': 'text/event-stream; charset=utf-8',
              'cache-control': 'no-store',
              'x-accel-buffering': 'no',
            },
          })
        : new Response(null, { status: 502 }),
  );
}

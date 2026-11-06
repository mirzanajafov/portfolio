import { sessionCookie, tokenIn } from '@/admin/cookies';
import { forwardEvent } from '@/analytics/forward';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return forwardEvent(request, apiUrl(), await tokenIn(sessionCookie));
}

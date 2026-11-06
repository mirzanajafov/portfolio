import { sessionCookie, tokenIn } from '@/admin/cookies';
import { forwardAsk } from '@/ask/forward';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return forwardAsk(request, apiUrl(), await tokenIn(sessionCookie));
}

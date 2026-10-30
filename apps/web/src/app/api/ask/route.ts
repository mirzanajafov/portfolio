import { forwardAsk } from '@/ask/forward';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return forwardAsk(request, apiUrl());
}

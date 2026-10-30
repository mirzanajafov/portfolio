import { forwardEvent } from '@/analytics/forward';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return forwardEvent(request, apiUrl());
}

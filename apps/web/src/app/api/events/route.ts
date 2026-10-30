import { forwardEvent } from '@/analytics/forward';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error('API_URL is not set, so visits have nowhere to go');
  }
  return forwardEvent(request, apiUrl);
}

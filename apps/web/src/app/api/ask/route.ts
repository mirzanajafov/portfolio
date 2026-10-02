import { forwardAsk } from '@/lib/forward-ask';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return forwardAsk(request, process.env.API_URL ?? 'http://localhost:3201');
}

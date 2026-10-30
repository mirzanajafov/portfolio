import { content } from '@portfolio/content';
import { refCode } from '@portfolio/content/analytics';
import { isRegistered } from '@/admin/api';
import { sessionCookie, tokenIn } from '@/admin/cookies';
import { cvAttachment } from '@/lib/cv-attachment';
import { apiUrl } from '@/lib/forward-to-api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: RouteContext<'/admin/applications/[code]/cv'>,
): Promise<Response> {
  const { code } = await params;
  const token = await tokenIn(sessionCookie);
  if (token === undefined || !refCode.test(code) || !(await isRegistered(apiUrl(), token, code))) {
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  return cvAttachment(content, code);
}

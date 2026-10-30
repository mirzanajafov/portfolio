import { adminLinkMinutes, adminToken } from '@portfolio/content/admin';
import { NextResponse, type NextRequest } from 'next/server';
import { linkCookie } from '@/admin/cookies';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest): Response {
  const token = request.nextUrl.searchParams.get('token');
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      location: '/admin/login',
      'cache-control': 'no-store',
    },
  });
  if (token !== null && adminToken.test(token)) {
    response.cookies.set({ ...linkCookie, value: token, maxAge: adminLinkMinutes * 60 });
  }
  return response;
}

import { content } from '@portfolio/content';
import { refCode } from '@portfolio/content/analytics';
import { timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { buildCvPdf, cvFileName } from '@/lib/cv-pdf';

export const dynamic = 'force-dynamic';

const dockerNetworks = new BlockList();
dockerNetworks.addSubnet('10.0.0.0', 8);
dockerNetworks.addSubnet('172.16.0.0', 12);
dockerNetworks.addSubnet('192.168.0.0', 16);
dockerNetworks.addSubnet('127.0.0.0', 8);
dockerNetworks.addSubnet('fc00::', 7, 'ipv6');
dockerNetworks.addAddress('::1', 'ipv6');

function fromInside(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  if (!forwarded) {
    return false;
  }
  const address = forwarded.replace(/^::ffff:/, '');
  const family = isIP(address);
  return family !== 0 && dockerNetworks.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function holdsToken(request: Request): boolean {
  const token = process.env.CV_RENDER_TOKEN;
  const given = request.headers.get('authorization');
  if (!token || !given) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/internal/cv/[code]'>,
): Promise<Response> {
  const { code } = await params;
  if (!refCode.test(code) || !holdsToken(request) || !fromInside(request)) {
    return new Response(null, { status: 404 });
  }
  const pdf = await buildCvPdf(content, { ref: code });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${cvFileName(content)}"`,
      'cache-control': 'no-store',
    },
  });
}

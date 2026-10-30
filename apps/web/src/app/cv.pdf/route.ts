import { content } from '@portfolio/content';
import { buildCvPdf, cvFileName } from '@/lib/cv-pdf';

export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const pdf = await buildCvPdf(content);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${cvFileName(content)}"`,
      'cache-control': 'public, max-age=3600',
    },
  });
}

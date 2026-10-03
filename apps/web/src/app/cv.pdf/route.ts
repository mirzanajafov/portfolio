import { content } from '@portfolio/content';
import { buildCvPdf } from '@/lib/cv-pdf';

export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const pdf = await buildCvPdf(content);
  const name = content.profile.name.replace(/\s+/g, '-');
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${name}-CV.pdf"`,
      'cache-control': 'public, max-age=3600',
    },
  });
}

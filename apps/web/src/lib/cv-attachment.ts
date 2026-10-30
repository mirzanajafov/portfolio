import type { Content } from '@portfolio/content';
import { buildCvPdf, cvFileName } from './cv-pdf';

export async function cvAttachment(content: Content, ref: string): Promise<Response> {
  const pdf = await buildCvPdf(content, { ref });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${cvFileName(content)}"`,
      'cache-control': 'no-store',
    },
  });
}

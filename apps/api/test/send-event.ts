import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

export const chrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

type Sender = { ip?: string; userAgent?: string | null; headers?: Record<string, string> };

export function sendEvent(
  app: NestExpressApplication,
  event: object,
  { ip = '203.0.113.7', userAgent = chrome, headers = {} }: Sender = {},
) {
  const call = request(app.getHttpServer()).post('/events').set('X-Forwarded-For', ip);
  if (userAgent === null) {
    call.unset('User-Agent');
  } else {
    call.set('User-Agent', userAgent);
  }
  return call.set(headers).send(event);
}

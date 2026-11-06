import type { NestExpressApplication } from '@nestjs/platform-express';
import { adminSignInSchema } from '@portfolio/content/admin';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AdminSessionsService } from '../src/admin/admin-sessions.service.js';
import { address } from './send-event.js';

export const unknownToken = () => randomBytes(32).toString('base64url');

export async function newSession(app: NestExpressApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/admin/sessions')
    .set('X-Forwarded-For', address)
    .send({ token: await app.get(AdminSessionsService).link() })
    .expect(201);
  return adminSignInSchema.parse(response.body).token;
}

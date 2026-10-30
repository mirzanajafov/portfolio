import * as z from 'zod/mini';
import { isoDate } from './time.ts';

export const adminToken = /^[\w-]{43}$/;
export const adminLinkMinutes = 10;
export const adminSessionDays = 30;

export const adminSessionSchema = z.object({ expiresAt: isoDate });

export const adminSignInSchema = z.object({
  token: z.string().check(z.regex(adminToken)),
  expiresAt: isoDate,
});

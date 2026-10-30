import * as z from 'zod/mini';

export const adminToken = /^[\w-]{43}$/;
export const adminLinkMinutes = 10;
export const adminSessionDays = 30;

export const adminSessionSchema = z.object({ expiresAt: z.iso.datetime() });

export const adminSignInSchema = z.object({
  token: z.string().check(z.regex(adminToken)),
  expiresAt: z.iso.datetime(),
});

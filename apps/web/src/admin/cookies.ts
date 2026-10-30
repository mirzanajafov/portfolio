import { adminToken } from '@portfolio/content/admin';
import { cookies } from 'next/headers';

export const linkCookie = {
  name: '__Host-admin-link',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

export const sessionCookie = {
  name: '__Host-admin',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const;

export async function tokenIn({ name }: { name: string }): Promise<string | undefined> {
  const value = (await cookies()).get(name)?.value;
  return value !== undefined && adminToken.test(value) ? value : undefined;
}

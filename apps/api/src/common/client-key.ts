import { createHmac } from 'node:crypto';

export function clientKey(ip: string, secret: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac('sha256', secret).update(`${day}:${ip}`).digest('hex').slice(0, 32);
}

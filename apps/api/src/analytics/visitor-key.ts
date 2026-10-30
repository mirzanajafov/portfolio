import { createHmac } from 'node:crypto';

export function dailyKey(secret: string, salt: Uint8Array): Uint8Array {
  return createHmac('sha256', secret).update(salt).digest();
}

export function keyed(key: Uint8Array, ...parts: string[]): string {
  return createHmac('sha256', key).update(parts.join('\n')).digest('hex').slice(0, 32);
}

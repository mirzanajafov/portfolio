import { createHmac } from 'node:crypto';
import { isIPv4 } from 'node:net';

const mappedIPv4 = '::ffff:';

export function networkOf(ip: string): string {
  if (isIPv4(ip)) {
    return ip;
  }
  if (ip.startsWith(mappedIPv4) && isIPv4(ip.slice(mappedIPv4.length))) {
    return ip.slice(mappedIPv4.length);
  }
  const [head = '', tail] = ip.toLowerCase().split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right];
  const prefix = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, ''));
  return `${prefix.join(':')}::/64`;
}

export function keyed(salt: Uint8Array, ...parts: string[]): string {
  return createHmac('sha256', salt).update(parts.join('\n')).digest('hex').slice(0, 32);
}

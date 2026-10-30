import { randomInt } from 'node:crypto';

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const length = 5;

export function newCode(): string {
  return Array.from({ length }, () => alphabet.charAt(randomInt(alphabet.length))).join('');
}

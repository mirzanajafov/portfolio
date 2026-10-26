import type { GateReason } from '@portfolio/content/ask';

type GateVerdict = { ok: true; text: string } | { ok: false; reason: GateReason };

export const gateThresholds = {
  echoRun: 8,
  answerCharacters: 700,
};

const denied = [
  /\b(salary|salaries|compensation|hourly rate|day rate|pay(ing)? me)\b/i,
  /\bi('ll| will| can) (start|join|sign|relocate) (on|by|next|in|immediately)\b/i,
  /\b(start(ing)? date|notice period)\b/i,
  /\bi (accept|agree to)\b/i,
];

const tag = /<[^\s<>][^<>]*>/g;

function withoutMarkup(text: string, gap: string): string {
  return text.replace(tag, gap).replace(/\s+/g, ' ').trim();
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function longestSharedRun(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  let best = 0;
  const row = () => Array.from({ length: right.length + 1 }, () => 0);
  let previous = row();
  for (let i = 1; i <= left.length; i += 1) {
    const current = row();
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        current[j] = (previous[j - 1] ?? 0) + 1;
        best = Math.max(best, current[j] ?? 0);
      }
    }
    previous = current;
  }
  return best;
}

export function gateSentence(
  sentence: { text: string; sourceCount: number },
  question: string,
  charactersSoFar: number,
): GateVerdict {
  if (sentence.sourceCount === 0) {
    return { ok: false, reason: 'unsupported' };
  }
  const text = withoutMarkup(sentence.text, ' ');
  if (words(text).length === 0) {
    return { ok: false, reason: 'empty' };
  }
  const readings = [text, withoutMarkup(sentence.text, '')];
  if (readings.some((reading) => longestSharedRun(reading, question) >= gateThresholds.echoRun)) {
    return { ok: false, reason: 'echo' };
  }
  if (readings.some((reading) => denied.some((pattern) => pattern.test(reading)))) {
    return { ok: false, reason: 'denied' };
  }
  if (charactersSoFar + text.length > gateThresholds.answerCharacters) {
    return { ok: false, reason: 'too-long' };
  }
  return { ok: true, text };
}

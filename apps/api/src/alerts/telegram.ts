import { z } from 'zod';
import { reasonOf } from '../common/error-reason.js';
import type { Env } from '../config/env.js';

export type Telegram = { apiUrl: string; token: string; chatId: string };

export type Delivery =
  { kind: 'sent' } | { kind: 'failed'; reason: string; retryAfterSeconds: number | null };

export const TELEGRAM = Symbol('TELEGRAM');

const sendTimeoutMs = 10_000;

const refusal = z.object({
  description: z.string().optional(),
  parameters: z.object({ retry_after: z.number().int().positive().optional() }).optional(),
});

export function telegramOf({
  TELEGRAM_API_URL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
}: Env): Telegram | null {
  return TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID
    ? { apiUrl: TELEGRAM_API_URL, token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID }
    : null;
}

export async function sendMessage(
  { apiUrl, token, chatId }: Telegram,
  text: string,
): Promise<Delivery> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(sendTimeoutMs),
    });
  } catch (error) {
    return { kind: 'failed', reason: reasonOf(error), retryAfterSeconds: null };
  }
  if (response.ok) {
    return { kind: 'sent' };
  }
  const parsed = refusal.safeParse(await response.json().catch(() => null));
  const { description, parameters } = parsed.success ? parsed.data : {};
  return {
    kind: 'failed',
    reason: description ? `${String(response.status)} ${description}` : String(response.status),
    retryAfterSeconds: parameters?.retry_after ?? null,
  };
}

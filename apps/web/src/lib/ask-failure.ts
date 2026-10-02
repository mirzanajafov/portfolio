export class AskFailure extends Error {}

export function failureMessage(status: number, retryAfter: string | null, email: string): string {
  if (status === 400) {
    return 'Keep it under 300 characters.';
  }
  if (status === 429) {
    const seconds = Number(retryAfter);
    const minutes = Math.max(1, Math.ceil((Number.isFinite(seconds) ? seconds : 60) / 60));
    const unit = minutes === 1 ? 'minute' : 'minutes';
    return `That's a lot of questions in a short time. Try again in ${minutes} ${unit}, or email me at ${email}.`;
  }
  return `I can't answer right now. Email me at ${email} instead.`;
}

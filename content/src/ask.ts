import * as z from 'zod/mini';

export const questionMaxLength = 300;
export const askLogDays = 30;

export const askRequestSchema = z.strictObject({
  question: z.string().check(z.trim(), z.minLength(1), z.maxLength(questionMaxLength)),
});

const gateReasonSchema = z.enum(['unsupported', 'empty', 'echo', 'denied', 'too-long']);

const sourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.optional(z.string()),
});

export const askEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), engine: z.string() }),
  z.object({ type: z.literal('sentence'), text: z.string(), sources: z.array(sourceSchema) }),
  z.object({ type: z.literal('withheld'), reason: gateReasonSchema }),
  z.object({ type: z.literal('done') }),
]);

export type AskRequest = z.infer<typeof askRequestSchema>;
export type GateReason = z.infer<typeof gateReasonSchema>;
export type AskSource = z.infer<typeof sourceSchema>;
export type AskEvent = z.infer<typeof askEventSchema>;

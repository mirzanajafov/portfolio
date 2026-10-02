import * as z from 'zod/mini';

export const sourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.optional(z.string()),
});

export const askEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), engine: z.string() }),
  z.object({ type: z.literal('sentence'), text: z.string(), sources: z.array(sourceSchema) }),
  z.object({ type: z.literal('withheld'), reason: z.string() }),
  z.object({ type: z.literal('done') }),
]);

export type AskSource = z.infer<typeof sourceSchema>;
export type AskEvent = z.infer<typeof askEventSchema>;

function parseBlock(block: string): AskEvent | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
    .join('\n');
  if (!data) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return undefined;
  }
  const parsed = askEventSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

export async function* readEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const event = parseBlock(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (event) {
        yield event;
      }
      end = buffer.indexOf('\n\n');
    }
  }
  const last = parseBlock((buffer + decoder.decode()).replace(/\r\n/g, '\n'));
  if (last) {
    yield last;
  }
}

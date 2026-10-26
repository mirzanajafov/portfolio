import { askEventSchema, type AskEvent } from '@portfolio/content/ask';

function parseBlock(block: string): AskEvent | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
    .join('\n');
  if (!data) {
    return undefined;
  }
  try {
    return askEventSchema.parse(JSON.parse(data));
  } catch (error) {
    console.warn('skipped an answer event this page does not understand', data, error);
    return undefined;
  }
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

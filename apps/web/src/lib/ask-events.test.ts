import { describe, expect, it } from 'vitest';
import { readEvents, type AskEvent } from './ask-events';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const event of readEvents(stream)) {
    events.push(event);
  }
  return events;
}

const sentence = { type: 'sentence', text: 'It works.', sources: [{ id: 'a', label: 'A' }] };
const block = (value: unknown) => `event: x\ndata: ${JSON.stringify(value)}\n\n`;

describe('readEvents', () => {
  it('reads every event from a stream', async () => {
    const events = await collect(
      streamOf(
        block({ type: 'meta', engine: 'keyword' }),
        block(sentence),
        block({ type: 'done' }),
      ),
    );
    expect(events.map((event) => event.type)).toEqual(['meta', 'sentence', 'done']);
  });

  it('puts an event back together when the network splits it across chunks', async () => {
    const whole = block(sentence);
    const events = await collect(streamOf(whole.slice(0, 7), whole.slice(7, 30), whole.slice(30)));
    expect(events).toEqual([sentence]);
  });

  it('copes with CRLF line endings, even when a chunk ends between the CR and the LF', async () => {
    const crlf = block(sentence).replace(/\n/g, '\r\n');
    const cut = crlf.indexOf('\r\n\r\n') + 1;
    const events = await collect(streamOf(crlf.slice(0, cut), crlf.slice(cut)));
    expect(events).toEqual([sentence]);
  });

  it('decodes a multi-byte character split across chunks', async () => {
    const bytes = new TextEncoder().encode(block({ ...sentence, text: 'Bakı · ü' }));
    const middle = bytes.indexOf(0xc4) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, middle));
        controller.enqueue(bytes.slice(middle));
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual([{ ...sentence, text: 'Bakı · ü' }]);
  });

  it('skips events it does not understand instead of failing the whole answer', async () => {
    const events = await collect(
      streamOf('data: not json\n\n', block({ type: 'mystery' }), block(sentence)),
    );
    expect(events).toEqual([sentence]);
  });
});

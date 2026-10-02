import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AskService } from './ask.service.js';

export const askRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(300),
});

@Controller('ask')
export class AskController {
  constructor(private readonly ask: AskService) {}

  @Post()
  @HttpCode(200)
  async stream(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const parsed = askRequestSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: 'question must be 1 to 300 characters' });
      return;
    }
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    for await (const event of this.ask.ask(parsed.data.question, abort.signal)) {
      if (abort.signal.aborted) {
        break;
      }
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}

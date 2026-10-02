import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { Clock } from '../common/clock.js';
import { ENV, type Env } from '../config/env.js';
import { RateLimiter } from '../limits/rate-limiter.js';
import { AskLogService, type AskLogEntry } from './ask-log.service.js';
import { AskService } from './ask.service.js';
import { clientKey } from './client-key.js';

export const askRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(300),
});

@Controller('ask')
export class AskController {
  constructor(
    private readonly ask: AskService,
    private readonly limiter: RateLimiter,
    private readonly askLog: AskLogService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @HttpCode(200)
  async stream(@Body() body: unknown, @Req() req: Request, @Res() res: Response): Promise<void> {
    const parsed = askRequestSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: 'question must be 1 to 300 characters' });
      return;
    }
    const question = parsed.data.question;
    const client = clientKey(req.ip ?? 'unknown', this.env.CLIENT_HASH_SECRET, this.clock.now());
    const verdict = await this.limiter.hitAll([
      { key: `ask:10m:${client}`, limit: this.env.ASK_PER_CLIENT_10_MIN, windowSeconds: 600 },
      { key: `ask:day:${client}`, limit: this.env.ASK_PER_CLIENT_DAY, windowSeconds: 86_400 },
      { key: 'ask:day:everyone', limit: this.env.ASK_PER_DAY, windowSeconds: 86_400 },
    ]);
    if (!verdict.allowed) {
      res
        .status(429)
        .set('Retry-After', String(verdict.retryAfterSeconds))
        .json({ message: 'too many questions', retryAfterSeconds: verdict.retryAfterSeconds });
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

    const started = performance.now();
    const entry: AskLogEntry = {
      client,
      question,
      engine: 'unknown',
      sentences: [],
      withheld: [],
      durationMs: 0,
    };
    for await (const event of this.ask.ask(question, abort.signal)) {
      if (event.type === 'meta') {
        entry.engine = event.engine;
      } else if (event.type === 'sentence') {
        entry.sentences.push({ text: event.text, sources: event.sources.map((s) => s.id) });
      } else if (event.type === 'withheld') {
        entry.withheld.push(event.reason);
      }
      if (abort.signal.aborted) {
        break;
      }
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
    entry.durationMs = Math.round(performance.now() - started);
    await this.askLog.record(entry);
  }
}

import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { questionMaxLength } from '@portfolio/content/ask';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { callerOf } from '../common/caller.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AskLimitsService } from './ask-limits.service.js';
import { AskLogService } from './ask-log.service.js';
import { AskService } from './ask.service.js';

const askRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(questionMaxLength),
});

type AskRequest = z.infer<typeof askRequestSchema>;

@Controller('ask')
export class AskController {
  constructor(
    private readonly ask: AskService,
    private readonly limits: AskLimitsService,
    private readonly askLog: AskLogService,
  ) {}

  @Post()
  async stream(
    @Body(new ZodPipe(askRequestSchema)) { question }: AskRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const caller = callerOf(req);
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const verdict = await this.limits.admit(caller.ip);
    if (!verdict.allowed) {
      res.set('Retry-After', String(verdict.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many questions', retryAfterSeconds: verdict.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const started = performance.now();
    const { events, outcome } = this.ask.answer(question, abort.signal);
    try {
      for await (const event of events) {
        if (abort.signal.aborted) {
          break;
        }
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      res.end();
    }
    await this.askLog.record({
      caller,
      question,
      ...outcome,
      durationMs: Math.round(performance.now() - started),
    });
  }
}

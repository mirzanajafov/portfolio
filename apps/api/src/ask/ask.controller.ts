import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { AskLimitsService } from './ask-limits.service.js';
import { AskLogService } from './ask-log.service.js';
import { AskService } from './ask.service.js';

const askRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(300),
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
    if (!req.ip) {
      throw new BadRequestException('the client has no address');
    }
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const client = this.limits.clientOf(req.ip);
    const verdict = await this.limits.admit(client);
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
    } catch (error) {
      res.destroy();
      throw error;
    }
    res.end();
    await this.askLog.record({
      client,
      question,
      ...outcome,
      durationMs: Math.round(performance.now() - started),
    });
  }
}

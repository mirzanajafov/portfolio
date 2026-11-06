import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { questionMaxLength } from '@portfolio/content/ask';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { AdminSessionsService } from '../admin-sessions/admin-sessions.service.js';
import { callerOf, visitorAgent } from '../common/caller.js';
import { ClockService } from '../common/clock.service.js';
import { SiteOriginGuard } from '../common/site-origin.guard.js';
import { TooManyRequestsException } from '../common/too-many-requests.exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { VisitorSaltService } from '../visitor-keys/visitor-salt.service.js';
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
    private readonly sessions: AdminSessionsService,
    private readonly salts: VisitorSaltService,
    private readonly clock: ClockService,
  ) {}

  @Post()
  @UseGuards(SiteOriginGuard)
  async stream(
    @Body(new ZodPipe(askRequestSchema)) { question }: AskRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const caller = callerOf(req);
    const askedAt = this.clock.now();
    const keys = await this.salts.dayKeys(askedAt);
    const verdict = await this.limits.admit(keys.limit(caller.ip));
    if (verdict.kind === 'limited') {
      throw new TooManyRequestsException('too many questions', verdict.retryAfterSeconds);
    }
    const signedIn = (await this.sessions.find(caller.sessionToken)) !== null;
    const agent = visitorAgent(caller);
    const visitor = agent === null ? null : keys.visitor(caller.ip, agent);

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
    if (!signedIn) {
      await this.askLog.record({
        visitor,
        createdAt: askedAt,
        question,
        ...outcome,
        durationMs: Math.round(performance.now() - started),
      });
    }
  }
}

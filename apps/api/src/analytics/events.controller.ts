import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { callerOf } from '../common/caller.js';
import { EventPipe, type AnalyticsEvent } from './event.schema.js';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(
    @Body(EventPipe) event: AnalyticsEvent,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const outcome = await this.events.accept(event, callerOf(req));
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many events', retryAfterSeconds: outcome.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

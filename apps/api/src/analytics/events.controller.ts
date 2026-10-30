import {
  BadRequestException,
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
import { isIP } from 'node:net';
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
    if (!req.ip || isIP(req.ip) === 0) {
      throw new BadRequestException('the client has no address');
    }
    const outcome = await this.events.accept(event, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      optedOut: req.get('sec-gpc') === '1' || req.get('dnt') === '1',
    });
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many events', retryAfterSeconds: outcome.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

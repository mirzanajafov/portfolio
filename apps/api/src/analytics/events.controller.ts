import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { callerOf } from '../common/caller.js';
import { TooManyRequestsException } from '../rate-limit/too-many-requests.exception.js';
import { EventPipe, PostedEvent } from './event.pipe.js';
import type { SourcedEvent } from './event.schema.js';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(@PostedEvent(EventPipe) sourced: SourcedEvent, @Req() req: Request): Promise<void> {
    const outcome = await this.events.accept(sourced, callerOf(req));
    if (outcome.kind === 'limited') {
      throw new TooManyRequestsException('too many events', outcome.retryAfterSeconds);
    }
  }
}

import { Catch, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { TooManyRequestsException } from './too-many-requests.exception.js';

@Catch(TooManyRequestsException)
export class TooManyRequestsFilter extends BaseExceptionFilter<TooManyRequestsException> {
  override catch(exception: TooManyRequestsException, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .set('Retry-After', String(exception.retryAfterSeconds));
    super.catch(exception, host);
  }
}

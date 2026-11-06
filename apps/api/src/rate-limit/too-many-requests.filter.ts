import { Catch, HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';

export class TooManyRequestsException extends HttpException {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

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

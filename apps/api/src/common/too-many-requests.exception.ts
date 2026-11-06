import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

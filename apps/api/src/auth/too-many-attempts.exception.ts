import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * TooManyAttemptsException — thrown when a login identity is locked by the
 * sliding-window failure-count policy (CP-02).
 * HTTP 429 Too Many Requests. Message is intentionally generic — it reveals
 * only that the identity is throttled, which the caller already knows.
 */
export class TooManyAttemptsException extends HttpException {
  constructor() {
    super('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

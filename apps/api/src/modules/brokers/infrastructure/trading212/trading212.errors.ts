import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  RequestTimeoutException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export class Trading212ConfigurationException extends ServiceUnavailableException {
  constructor(message: string) {
    super(`Trading212 configuration error: ${message}`);
  }
}

export class Trading212UnauthorizedException extends UnauthorizedException {
  constructor(message = 'Trading212 unauthorized request') {
    super(message);
  }
}

export class Trading212ForbiddenException extends ForbiddenException {
  constructor(message = 'Trading212 forbidden request') {
    super(message);
  }
}

export class Trading212RequestTimeoutException extends RequestTimeoutException {
  constructor(timeoutMs: number) {
    super(`Trading212 request timed out after ${timeoutMs}ms`);
  }
}

export class Trading212NetworkException extends ServiceUnavailableException {
  constructor(message: string) {
    super(`Trading212 request failed: ${message}`);
  }
}

export class Trading212HttpException extends BadGatewayException {
  constructor(status: number, message?: string) {
    super(message ? `Trading212 HTTP error ${status}: ${message}` : `Trading212 HTTP error ${status}`);
  }
}

export class Trading212RateLimitException extends HttpException {
  readonly retryAfterMs?: number;

  constructor(message = 'Trading212 rate limit exceeded', retryAfterMs?: number) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
    this.retryAfterMs = retryAfterMs;
  }
}

export class Trading212MalformedResponseException extends BadGatewayException {
  constructor(reason: string) {
    super(`Trading212 returned a malformed response: ${reason}`);
  }
}
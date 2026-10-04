export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, code = 'EXTERNAL_SERVICE_ERROR', statusCode = 502) {
    super(statusCode, code, message);
  }
}

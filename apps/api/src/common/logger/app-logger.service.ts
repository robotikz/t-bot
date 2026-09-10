import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  constructor() {
    super();
  }

  log(message: string, context?: string) {
    super.log(message, context);
  }

  error(message: string, stack?: string, context?: string) {
    super.error(message, stack, context);
  }

  warn(message: string, context?: string) {
    super.warn(message, context);
  }
}

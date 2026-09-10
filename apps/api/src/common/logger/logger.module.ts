import { Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service.js';

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}

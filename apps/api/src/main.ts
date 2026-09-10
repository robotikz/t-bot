import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppLoggerService } from './common/logger/app-logger.service.js';
import { AppModule } from './app.module.js';
import { ConfigService } from './modules/config/config.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLoggerService);
  const config = app.get(ConfigService);

  app.useLogger(logger);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: config.getString('FRONTEND_URL', 'http://localhost:4200'),
    credentials: true,
  });

  const apiPrefix = config.getString('API_PREFIX', 'api');
  const port = config.getNumber('PORT', 3000);

  app.setGlobalPrefix(apiPrefix);
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  logger.log(`Environment: ${config.getString('NODE_ENV', 'development')}`, 'Bootstrap');

  const gracefulShutdown = async (signal: NodeJS.Signals) => {
    logger.warn(`Received ${signal}. Shutting down application.`, 'Bootstrap');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
}

bootstrap();

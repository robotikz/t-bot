import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './modules/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);

  const frontend = config.get('FRONTEND_URL', 'http://localhost:4200');
  app.enableCors({ origin: frontend, credentials: true });

  const apiPrefix = config.get('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  const port = Number(config.get('PORT', '3000'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Server running: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();

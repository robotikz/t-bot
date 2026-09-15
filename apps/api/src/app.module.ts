import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { RequestLoggerMiddleware } from './common/logger/request-logger.middleware.js';
import { ConfigModule } from './modules/config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ExchangesModule } from './modules/exchanges/exchanges.module.js';
import { StrategiesModule } from './modules/strategies/strategies.module.js';
import { CandlesModule } from './modules/candles/candles.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { TradesModule } from './modules/trades/trades.module.js';
import { BrokersModule } from './modules/brokers/brokers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, HealthModule, ExchangesModule, StrategiesModule, CandlesModule, OrdersModule, TradesModule, BrokersModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

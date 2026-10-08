import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SignalizerController } from './signalizer.controller.js';
import { SignalizerService } from './signalizer.service.js';
import { PrismaSignalHistoryRepository } from './repositories/prisma-signal-history.repository.js';
import { PrismaSignalTransitionRepository } from './repositories/prisma-signal-transition.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SignalizerController],
  providers: [
    SignalizerService,
    PrismaSignalHistoryRepository,
    PrismaSignalTransitionRepository,
    PrismaService
  ],
  exports: [SignalizerService]
})
export class SignalizerModule {}

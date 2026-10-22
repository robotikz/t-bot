import { Module } from '@nestjs/common';
import { SignalizerController } from './signalizer.controller.js';
import { SignalizerService } from './signalizer.service.js';
import { InMemorySignalHistoryRepository } from './repositories/in-memory-signal-history.repository.js';
import { InMemorySignalTransitionRepository } from './repositories/in-memory-signal-transition.repository.js';

@Module({
  controllers: [SignalizerController],
  providers: [
    SignalizerService,
    InMemorySignalHistoryRepository,
    InMemorySignalTransitionRepository,
    {
      provide: 'SignalHistoryRepository',
      useExisting: InMemorySignalHistoryRepository,
    },
    {
      provide: 'SignalTransitionRepository',
      useExisting: InMemorySignalTransitionRepository,
    },
  ],
  exports: [SignalizerService]
})
export class SignalizerModule {}

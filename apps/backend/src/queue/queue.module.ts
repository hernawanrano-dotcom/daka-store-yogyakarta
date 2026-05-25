import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventProducer } from './producers/event.producer';
import { OutboxProcessor } from './processors/outbox.processor';
import { SearchSyncProcessor } from './processors/search-sync.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { MeilisearchModule } from '../../../infrastructure/meilisearch/meilisearch.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get('REDIS_URL'),
        },
        prefix: 'bull',
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'outbox' },
      { name: 'search-sync' },
      { name: 'notification' },
      { name: 'tracking' },
      { name: 'refund' }
    ),
    PrismaModule,
    MeilisearchModule,
  ],
  providers: [EventProducer, OutboxProcessor, SearchSyncProcessor],
  exports: [EventProducer],
})
export class QueueModule {}

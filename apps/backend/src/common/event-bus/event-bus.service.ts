import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue('outbox') private outboxQueue: Queue,
    private prisma: PrismaService
  ) {}

  async onModuleInit() {
    this.logger.log('EventBusService initialized');
  }

  /**
   * Save event to outbox table for reliable publishing
   */
  async publishOutbox(eventName: string, payload: any, aggregateId?: string) {
    try {
      await this.prisma.outboxMessage.create({
        data: {
          event_name: eventName,
          aggregate_id: aggregateId || payload.userId || payload.orderId || 'unknown',
          payload: payload as any,
          status: 'pending',
          retry_count: 0,
        },
      });

      this.logger.debug(`Event ${eventName} saved to outbox`);
    } catch (error) {
      this.logger.error(`Failed to save event ${eventName} to outbox: ${error.message}`);
      throw error;
    }
  }

  /**
   * Publish event directly (for internal use only, prefer outbox)
   */
  async publishDirect(eventName: string, payload: any) {
    // Add to BullMQ queue for processing
    await this.outboxQueue.add('publish-event', {
      eventName,
      payload,
    });

    this.logger.debug(`Event ${eventName} queued for publishing`);
  }
}

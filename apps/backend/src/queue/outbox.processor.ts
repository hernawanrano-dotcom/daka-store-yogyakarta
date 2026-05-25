import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@Processor('outbox.publisher')
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<{ messageId: string }>): Promise<any> {
    const { messageId } = job.data;

    const message = await this.prisma.outboxMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.status !== 'pending') {
      return;
    }

    try {
      // Publish event ke event bus (BullMQ atau EventEmitter)
      this.eventEmitter.emit(message.event_name, message.payload);

      // Update status ke published
      await this.prisma.outboxMessage.update({
        where: { id: messageId },
        data: {
          status: 'published',
          published_at: new Date(),
        },
      });

      this.logger.debug(`Outbox message published: ${message.event_name}`);
    } catch (error) {
      this.logger.error(`Failed to publish outbox message ${messageId}: ${error.message}`);

      // Increment retry count
      await this.prisma.outboxMessage.update({
        where: { id: messageId },
        data: {
          retry_count: { increment: 1 },
          error_message: error.message,
        },
      });

      if (message.retry_count >= 5) {
        await this.prisma.outboxMessage.update({
          where: { id: messageId },
          data: { status: 'failed' },
        });
      }

      throw error;
    }
  }
}
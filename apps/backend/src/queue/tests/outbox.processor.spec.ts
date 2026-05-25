import { Test, TestingModule } from '@nestjs/testing';
import { OutboxProcessor } from '../outbox.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockMessage = {
    id: 'msg_001',
    event_name: 'PAYMENT_SUCCESS',
    payload: { orderId: 'ord_001', amount: 100000 },
    status: 'pending',
    retry_count: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        {
          provide: PrismaService,
          useValue: {
            outboxMessage: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get(OutboxProcessor);
    prisma = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('process', () => {
    it('should publish message successfully', async () => {
      (prisma.outboxMessage.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.outboxMessage.update as jest.Mock).mockResolvedValue({});
      (eventEmitter.emit as jest.Mock).mockReturnValue(true);

      const job = { data: { messageId: 'msg_001' } } as Job;
      await processor.process(job);

      expect(eventEmitter.emit).toHaveBeenCalledWith('PAYMENT_SUCCESS', mockMessage.payload);
      expect(prisma.outboxMessage.update).toHaveBeenCalled();
    });

    it('should skip if message already published', async () => {
      (prisma.outboxMessage.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        status: 'published',
      });

      const job = { data: { messageId: 'msg_001' } } as Job;
      await processor.process(job);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should increment retry count on failure', async () => {
      (prisma.outboxMessage.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (eventEmitter.emit as jest.Mock).mockImplementation(() => {
        throw new Error('Network error');
      });
      (prisma.outboxMessage.update as jest.Mock).mockResolvedValue({});

      const job = { data: { messageId: 'msg_001' } } as Job;

      await expect(processor.process(job)).rejects.toThrow('Network error');

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg_001' },
        data: {
          retry_count: { increment: 1 },
          error_message: 'Network error',
        },
      });
    });

    it('should mark as failed after 5 retries', async () => {
      (prisma.outboxMessage.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        retry_count: 5,
      });
      (eventEmitter.emit as jest.Mock).mockImplementation(() => {
        throw new Error('Network error');
      });
      (prisma.outboxMessage.update as jest.Mock).mockResolvedValue({});

      const job = { data: { messageId: 'msg_001' } } as Job;

      await expect(processor.process(job)).rejects.toThrow('Network error');

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg_001' },
        data: {
          retry_count: { increment: 1 },
          error_message: 'Network error',
          status: 'failed',
        },
      });
    });
  });
});

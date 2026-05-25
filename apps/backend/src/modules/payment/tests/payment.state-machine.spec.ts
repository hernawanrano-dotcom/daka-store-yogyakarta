import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStateMachine } from '../payment.state-machine';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PaymentStateMachine', () => {
  let stateMachine: PaymentStateMachine;
  let prisma: PrismaService;

  const mockPayment = {
    id: 'pay_001',
    status: PaymentStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentStateMachine,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    stateMachine = module.get(PaymentStateMachine);
    prisma = module.get(PrismaService);
  });

  describe('canTransition', () => {
    it('should allow PENDING to SUCCESS', () => {
      expect(stateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.SUCCESS)).toBe(true);
    });

    it('should allow PENDING to FAILED', () => {
      expect(stateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    });

    it('should allow PENDING to EXPIRED', () => {
      expect(stateMachine.canTransition(PaymentStatus.PENDING, PaymentStatus.EXPIRED)).toBe(true);
    });

    it('should allow SUCCESS to REFUNDED', () => {
      expect(stateMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.REFUNDED)).toBe(true);
    });

    it('should NOT allow SUCCESS to FAILED', () => {
      expect(stateMachine.canTransition(PaymentStatus.SUCCESS, PaymentStatus.FAILED)).toBe(false);
    });

    it('should NOT allow FAILED to anything', () => {
      expect(stateMachine.canTransition(PaymentStatus.FAILED, PaymentStatus.SUCCESS)).toBe(false);
      expect(stateMachine.canTransition(PaymentStatus.FAILED, PaymentStatus.PENDING)).toBe(false);
    });
  });

  describe('transition', () => {
    it('should transition successfully', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      await stateMachine.transition('pay_001', PaymentStatus.SUCCESS);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_001' },
        data: { status: PaymentStatus.SUCCESS },
      });
    });

    it('should throw error if payment not found', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(stateMachine.transition('pay_999', PaymentStatus.SUCCESS)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error on invalid transition', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      await expect(stateMachine.transition('pay_001', PaymentStatus.REFUNDED)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});

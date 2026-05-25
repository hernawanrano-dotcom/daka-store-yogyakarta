import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { PaymentStateMachine } from '../payment.state-machine';
import { MidtransClient } from '../midtrans.client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;
  let stateMachine: PaymentStateMachine;
  let midtrans: MidtransClient;

  const mockPayment = {
    id: 'pay_001',
    master_order_id: 'ord_001',
    amount: 150000,
    method: PaymentMethod.QRIS,
    status: PaymentStatus.PENDING,
    midtrans_id: 'mid_001',
    created_at: new Date(),
    expired_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            idempotencyKey: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            outboxMessage: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: PaymentStateMachine,
          useValue: {
            transition: jest.fn(),
          },
        },
        {
          provide: MidtransClient,
          useValue: {
            createTransaction: jest.fn(),
            verifySignature: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentService);
    prisma = module.get(PrismaService);
    stateMachine = module.get(PaymentStateMachine);
    midtrans = module.get(MidtransClient);
  });

  describe('findById', () => {
    it('should return payment when exists', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.findById('pay_001');

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'pay_001' },
      });
    });
  });

  describe('createPayment', () => {
    it('should create payment and return payment url', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (midtrans.createTransaction as jest.Mock).mockResolvedValue({
        token: 'token_001',
        redirectUrl: 'https://midtrans.com/pay/xxx',
        transactionId: 'mid_001',
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.createPayment(
        'ord_001',
        PaymentMethod.QRIS,
        150000,
        'buyer@example.com'
      );

      expect(result).toHaveProperty('paymentId', 'pay_001');
      expect(result).toHaveProperty('paymentUrl');
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should throw error if payment already exists', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      await expect(
        service.createPayment('ord_001', PaymentMethod.QRIS, 150000, 'buyer@example.com')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    const mockPayload = {
      order_id: 'ord_001',
      transaction_status: 'settlement',
      payment_type: 'qris',
      transaction_id: 'mid_001',
      gross_amount: '150000',
    };

    it('should reject invalid signature', async () => {
      (midtrans.verifySignature as jest.Mock).mockReturnValue(false);

      await expect(service.handleWebhook(mockPayload, 'invalid_signature')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should skip duplicate webhook', async () => {
      (midtrans.verifySignature as jest.Mock).mockReturnValue(true);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue({
        key: 'ord_001_settlement',
      });

      const result = await service.handleWebhook(mockPayload, 'valid_signature');

      expect(result).toBeUndefined();
    });

    it('should process successful payment', async () => {
      (midtrans.verifySignature as jest.Mock).mockReturnValue(true);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.idempotencyKey.create as jest.Mock).mockResolvedValue({});
      (stateMachine.transition as jest.Mock).mockResolvedValue(undefined);
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      await service.handleWebhook(mockPayload, 'valid_signature');

      expect(stateMachine.transition).toHaveBeenCalledWith('pay_001', PaymentStatus.SUCCESS);
      expect(prisma.outboxMessage.create).toHaveBeenCalled();
    });
  });
});

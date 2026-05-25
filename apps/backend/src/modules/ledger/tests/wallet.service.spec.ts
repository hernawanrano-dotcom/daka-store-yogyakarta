import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../wallet.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: PrismaService;

  const mockWallet = {
    id: 'wal_001',
    user_id: 'user_001',
    balance: 500000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: {
            wallet: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            walletTransaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            outboxMessage: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(WalletService);
    prisma = module.get(PrismaService);
  });

  describe('getWalletByUserId', () => {
    it('should return wallet when exists', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);

      const result = await service.getWalletByUserId('user_001');

      expect(result).toEqual(mockWallet);
    });

    it('should throw NotFoundException when wallet not found', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getWalletByUserId('user_999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBalance', () => {
    it('should return balance', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);

      const balance = await service.getBalance('user_001');

      expect(balance).toBe(500000);
    });
  });

  describe('updateBalance', () => {
    it('should credit balance successfully', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);
      (prisma.wallet.update as jest.Mock).mockResolvedValue({ ...mockWallet, balance: 600000 });
      (prisma.walletTransaction.create as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const newBalance = await service.updateBalance('wal_001', 100000, 'CREDIT');

      expect(newBalance).toBe(600000);
      expect(prisma.wallet.update).toHaveBeenCalled();
    });

    it('should debit balance successfully', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);
      (prisma.wallet.update as jest.Mock).mockResolvedValue({ ...mockWallet, balance: 400000 });
      (prisma.walletTransaction.create as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const newBalance = await service.updateBalance('wal_001', 100000, 'DEBIT');

      expect(newBalance).toBe(400000);
    });

    it('should throw error when insufficient balance for debit', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);

      await expect(service.updateBalance('wal_001', 600000, 'DEBIT')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('createWalletForUser', () => {
    it('should create wallet for user', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.wallet.create as jest.Mock).mockResolvedValue({
        id: 'wal_new',
        user_id: 'user_new',
        balance: 0,
      });
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      await service.createWalletForUser('user_new');

      expect(prisma.wallet.create).toHaveBeenCalled();
      expect(prisma.outboxMessage.create).toHaveBeenCalled();
    });

    it('should not create if wallet already exists', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(mockWallet);

      await service.createWalletForUser('user_001');

      expect(prisma.wallet.create).not.toHaveBeenCalled();
    });
  });
});

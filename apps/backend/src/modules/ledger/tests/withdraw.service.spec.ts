import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawService } from '../withdraw.service';
import { WalletService } from '../wallet.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('WithdrawService', () => {
  let service: WithdrawService;
  let walletService: WalletService;
  let prisma: PrismaService;

  const mockWallet = {
    id: 'wal_001',
    user_id: 'user_001',
    balance: 1000000,
  };

  const mockWithdraw = {
    id: 'wd_001',
    user_id: 'user_001',
    amount: 100000,
    bank_name: 'BCA',
    bank_account: '1234567890',
    bank_account_name: 'Budi Santoso',
    status: 'PENDING',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawService,
        {
          provide: WalletService,
          useValue: {
            getWalletByUserId: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            withdraw: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            outboxMessage: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(WithdrawService);
    walletService = module.get(WalletService);
    prisma = module.get(PrismaService);
  });

  describe('requestWithdraw', () => {
    it('should create withdraw request', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue(mockWallet);
      (walletService.updateBalance as jest.Mock).mockResolvedValue(900000);
      (prisma.withdraw.create as jest.Mock).mockResolvedValue(mockWithdraw);
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const result = await service.requestWithdraw(
        'user_001',
        100000,
        'BCA',
        '1234567890',
        'Budi Santoso'
      );

      expect(result).toEqual(mockWithdraw);
      expect(walletService.updateBalance).toHaveBeenCalled();
    });

    it('should throw error if amount below minimum', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue(mockWallet);

      await expect(
        service.requestWithdraw('user_001', 10000, 'BCA', '1234567890', 'Budi Santoso')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if amount above maximum', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue(mockWallet);

      await expect(
        service.requestWithdraw('user_001', 20000000, 'BCA', '1234567890', 'Budi Santoso')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if insufficient balance', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue({
        ...mockWallet,
        balance: 50000,
      });

      await expect(
        service.requestWithdraw('user_001', 100000, 'BCA', '1234567890', 'Budi Santoso')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveWithdraw', () => {
    it('should approve withdraw', async () => {
      (prisma.withdraw.findUnique as jest.Mock).mockResolvedValue(mockWithdraw);
      (prisma.withdraw.update as jest.Mock).mockResolvedValue({
        ...mockWithdraw,
        status: 'COMPLETED',
      });
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const result = await service.approveWithdraw('wd_001', 'admin_001');

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error if withdraw not found', async () => {
      (prisma.withdraw.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.approveWithdraw('wd_999', 'admin_001')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('rejectWithdraw', () => {
    it('should reject withdraw and restore balance', async () => {
      (prisma.withdraw.findUnique as jest.Mock).mockResolvedValue(mockWithdraw);
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue(mockWallet);
      (walletService.updateBalance as jest.Mock).mockResolvedValue(1100000);
      (prisma.withdraw.update as jest.Mock).mockResolvedValue({
        ...mockWithdraw,
        status: 'REJECTED',
      });

      const result = await service.rejectWithdraw('wd_001', 'admin_001', 'Invalid bank account');

      expect(result.status).toBe('REJECTED');
      expect(walletService.updateBalance).toHaveBeenCalled();
    });
  });
});

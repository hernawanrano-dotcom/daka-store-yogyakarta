import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService } from '../escrow.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JournalService } from '../journal.service';
import { WalletService } from '../wallet.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let walletService: WalletService;
  let journalService: JournalService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: PrismaService,
          useValue: {
            outboxMessage: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: WalletService,
          useValue: {
            getWalletByUserId: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: JournalService,
          useValue: {
            createEntry: jest.fn(),
            getBalanceForAccount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EscrowService);
    walletService = module.get(WalletService);
    journalService = module.get(JournalService);
    prisma = module.get(PrismaService);
  });

  describe('holdFunds', () => {
    it('should hold funds in escrow', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue({ id: 'wal_buyer', balance: 500000 });
      (walletService.updateBalance as jest.Mock).mockResolvedValue(400000);
      (journalService.createEntry as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      await service.holdFunds('ord_001', 'buyer_001', 100000);

      expect(walletService.updateBalance).toHaveBeenCalled();
      expect(journalService.createEntry).toHaveBeenCalledTimes(2);
      expect(prisma.outboxMessage.create).toHaveBeenCalled();
    });
  });

  describe('releaseFunds', () => {
    it('should release funds to seller with fee', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue({ id: 'wal_seller', balance: 0 });
      (walletService.updateBalance as jest.Mock).mockResolvedValue(97000);
      (journalService.createEntry as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const result = await service.releaseFunds('ord_001', 'seller_001', 100000, 3);

      expect(result).toEqual({ sellerAmount: 97000, platformFee: 3000 });
      expect(walletService.updateBalance).toHaveBeenCalled();
      expect(journalService.createEntry).toHaveBeenCalledTimes(3);
    });

    it('should use default fee percentage 3%', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue({ id: 'wal_seller', balance: 0 });
      (walletService.updateBalance as jest.Mock).mockResolvedValue(97000);
      (journalService.createEntry as jest.Mock).mockResolvedValue({});
      (prisma.outboxMessage.create as jest.Mock).mockResolvedValue({});

      const result = await service.releaseFunds('ord_001', 'seller_001', 100000);

      expect(result).toEqual({ sellerAmount: 97000, platformFee: 3000 });
    });
  });

  describe('refundFromEscrow', () => {
    it('should refund from escrow to buyer', async () => {
      (walletService.getWalletByUserId as jest.Mock).mockResolvedValue({ id: 'wal_buyer', balance: 0 });
      (walletService.updateBalance as jest.Mock).mockResolvedValue(100000);
      (journalService.createEntry as jest.Mock).mockResolvedValue({});

      await service.refundFromEscrow('ord_001', 'buyer_001', 100000);

      expect(walletService.updateBalance).toHaveBeenCalled();
      expect(journalService.createEntry).toHaveBeenCalledTimes(2);
    });
  });

  describe('getEscrowBalance', () => {
    it('should return escrow balance', async () => {
      (journalService.getBalanceForAccount as jest.Mock).mockResolvedValue({ balance: 5000000 });

      const balance = await service.getEscrowBalance();

      expect(balance).toBe(5000000);
    });
  });
});
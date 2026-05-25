import { Test, TestingModule } from '@nestjs/testing';
import { JournalService } from '../journal.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('JournalService', () => {
  let service: JournalService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: PrismaService,
          useValue: {
            journalEntry: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(JournalService);
    prisma = module.get(PrismaService);
  });

  describe('createEntry', () => {
    it('should create journal entry', async () => {
      (prisma.journalEntry.create as jest.Mock).mockResolvedValue({});

      await service.createEntry({
        transactionId: 'tx_001',
        account: 'ESCROW',
        debit: 100000,
        credit: 0,
      });

      expect(prisma.journalEntry.create).toHaveBeenCalledWith({
        data: {
          transaction_id: 'tx_001',
          account: 'ESCROW',
          debit: 100000,
          credit: 0,
        },
      });
    });
  });

  describe('getBalanceForAccount', () => {
    it('should calculate balance correctly', async () => {
      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue([
        { debit: 100000, credit: 0 },
        { debit: 50000, credit: 0 },
        { debit: 0, credit: 30000 },
      ]);

      const result = await service.getBalanceForAccount('ESCROW');

      expect(result).toEqual({
        debit: 150000,
        credit: 30000,
        balance: 120000,
      });
    });
  });

  describe('getTransactionJournal', () => {
    it('should return all entries for transaction', async () => {
      const mockEntries = [
        { id: '1', transaction_id: 'tx_001', account: 'ESCROW', debit: 100000, credit: 0 },
        { id: '2', transaction_id: 'tx_001', account: 'BUYER_WALLET', debit: 0, credit: 100000 },
      ];

      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await service.getTransactionJournal('tx_001');

      expect(result).toEqual(mockEntries);
      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { transaction_id: 'tx_001' },
        orderBy: { created_at: 'asc' },
      });
    });
  });
});

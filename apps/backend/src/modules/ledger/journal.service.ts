import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(private prisma: PrismaService) {}

  async createEntry(data: {
    transactionId: string;
    account: string;
    debit: number;
    credit: number;
  }): Promise<void> {
    await this.prisma.journalEntry.create({
      data: {
        transaction_id: data.transactionId,
        account: data.account,
        debit: data.debit,
        credit: data.credit,
      },
    });

    this.logger.debug(`Journal entry created: ${data.account} D:${data.debit} C:${data.credit}`);
  }

  async getBalanceForAccount(account: string): Promise<{ debit: number; credit: number; balance: number }> {
    const entries = await this.prisma.journalEntry.findMany({
      where: { account },
    });

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return {
      debit: totalDebit,
      credit: totalCredit,
      balance: totalDebit - totalCredit,
    };
  }

  async getTransactionJournal(transactionId: string) {
    return this.prisma.journalEntry.findMany({
      where: { transaction_id: transactionId },
      orderBy: { created_at: 'asc' },
    });
  }
}
import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import { JournalService } from './journal.service';

@Module({
  providers: [LedgerService, WalletService, JournalService, PrismaService],
  exports: [LedgerService, WalletService, JournalService],
})
export class LedgerModule {}

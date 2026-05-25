import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { JournalService } from './journal.service';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private journalService: JournalService,
  ) {}

  // Escrow: dana ditahan saat payment success
  async createEscrow(orderId: string, amount: number): Promise<void> {
    // 1. Debit dari customer wallet (atau langsung dari external)
    // 2. Credit ke escrow account

    const transactionId = `escrow_${orderId}`;

    await this.journalService.createEntry({
      transactionId,
      account: 'CUSTOMER_WALLET',
      debit: amount,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'PLATFORM_ESCROW',
      debit: 0,
      credit: amount,
    });

    this.logger.log(`Escrow created for order ${orderId}: ${amount}`);
  }

  // Release escrow ke seller saat order completed
  async releaseEscrow(orderId: string, sellerId: string, amount: number, fee: number): Promise<void> {
    const sellerWallet = await this.walletService.getWalletByUserId(sellerId);
    const netAmount = amount - fee;

    const transactionId = `release_${orderId}`;

    // 1. Debit dari escrow
    await this.journalService.createEntry({
      transactionId,
      account: 'PLATFORM_ESCROW',
      debit: amount,
      credit: 0,
    });

    // 2. Credit ke seller wallet
    await this.journalService.createEntry({
      transactionId,
      account: 'SELLER_WALLET',
      debit: 0,
      credit: netAmount,
    });

    // 3. Debit fee dari seller (opsional, dicatat sebagai pendapatan platform)
    await this.journalService.createEntry({
      transactionId,
      account: 'SELLER_WALLET',
      debit: fee,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'PLATFORM_REVENUE',
      debit: 0,
      credit: fee,
    });

    // Update wallet balance
    await this.walletService.updateBalance(sellerWallet.id, netAmount, 'CREDIT');
    await this.walletService.updateBalance(sellerWallet.id, fee, 'DEBIT');

    // Simpan ke outbox
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ESCROW_RELEASED',
        aggregate_id: orderId,
        payload: {
          orderId,
          sellerId,
          amount: netAmount,
          fee,
          releasedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Escrow released for order ${orderId}: net=${netAmount}, fee=${fee}`);
  }
}
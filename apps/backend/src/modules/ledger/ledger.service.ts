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
    private journalService: JournalService
  ) {}

  async createEscrow(orderId: string, amount: number): Promise<void> {
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

    // ✅ EVENT: ESCROW_CREATED via outbox
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ESCROW_CREATED',
        aggregate_id: orderId,
        payload: {
          orderId: orderId,
          amount: amount,
          escrowedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Escrow created for order ${orderId}: ${amount}`);
  }

  async releaseEscrow(
    orderId: string,
    sellerId: string,
    amount: number,
    fee: number
  ): Promise<void> {
    const sellerWallet = await this.walletService.getWalletByUserId(sellerId);
    const netAmount = amount - fee;

    const transactionId = `release_${orderId}`;

    await this.journalService.createEntry({
      transactionId,
      account: 'PLATFORM_ESCROW',
      debit: amount,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'SELLER_WALLET',
      debit: 0,
      credit: netAmount,
    });

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

    await this.walletService.updateBalance(sellerWallet.id, netAmount, 'CREDIT');
    await this.walletService.updateBalance(sellerWallet.id, fee, 'DEBIT');

    // ✅ EVENT: ESCROW_RELEASED via outbox
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ESCROW_RELEASED',
        aggregate_id: orderId,
        payload: {
          orderId: orderId,
          sellerId: sellerId,
          amount: netAmount,
          fee: fee,
          releasedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Escrow released for order ${orderId}: net=${netAmount}, fee=${fee}`);
  }

  async creditWallet(
    walletId: string,
    userId: string,
    amount: number,
    referenceId: string,
    referenceType: string
  ) {
    const newBalance = await this.walletService.updateBalance(
      walletId,
      amount,
      'CREDIT',
      referenceType,
      referenceId,
      `Credit from ${referenceType}`
    );

    // ✅ EVENT: WALLET_CREDITED via outbox
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'WALLET_CREDITED',
        aggregate_id: walletId,
        payload: {
          walletId: walletId,
          userId: userId,
          amount: amount,
          balanceAfter: newBalance,
          referenceId: referenceId,
          referenceType: referenceType,
          creditedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    return newBalance;
  }

  async debitWallet(
    walletId: string,
    userId: string,
    amount: number,
    referenceId: string,
    referenceType: string
  ) {
    const newBalance = await this.walletService.updateBalance(
      walletId,
      amount,
      'DEBIT',
      referenceType,
      referenceId,
      `Debit from ${referenceType}`
    );

    // ✅ EVENT: WALLET_DEBITED via outbox
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'WALLET_DEBITED',
        aggregate_id: walletId,
        payload: {
          walletId: walletId,
          userId: userId,
          amount: amount,
          balanceAfter: newBalance,
          referenceId: referenceId,
          referenceType: referenceType,
          debitedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    return newBalance;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from './journal.service';
import { WalletService } from './wallet.service';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private prisma: PrismaService,
    private journalService: JournalService,
    private walletService: WalletService
  ) {}

  async holdFunds(orderId: string, buyerId: string, amount: number): Promise<void> {
    const buyerWallet = await this.walletService.getWalletByUserId(buyerId);

    // Kurangi saldo buyer (pindah ke escrow)
    await this.walletService.updateBalance(
      buyerWallet.id,
      amount,
      'DEBIT',
      'ORDER',
      orderId,
      `Escrow hold for order ${orderId}`
    );

    // Journal entry
    const transactionId = `escrow_hold_${orderId}`;

    await this.journalService.createEntry({
      transactionId,
      account: 'BUYER_WALLET',
      debit: amount,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'ESCROW',
      debit: 0,
      credit: amount,
    });

    // Outbox event
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ESCROW_CREATED',
        aggregate_id: orderId,
        payload: {
          orderId,
          buyerId,
          amount,
          escrowedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Escrow hold ${amount} for order ${orderId}`);
  }

  async releaseFunds(
    orderId: string,
    sellerId: string,
    amount: number,
    feePercentage: number = 3
  ): Promise<{ sellerAmount: number; platformFee: number }> {
    const fee = Math.floor((amount * feePercentage) / 100);
    const sellerAmount = amount - fee;

    const sellerWallet = await this.walletService.getWalletByUserId(sellerId);

    // Tambah saldo seller
    await this.walletService.updateBalance(
      sellerWallet.id,
      sellerAmount,
      'CREDIT',
      'ORDER',
      orderId,
      `Escrow release for order ${orderId}`
    );

    // Journal entry
    const transactionId = `escrow_release_${orderId}`;

    await this.journalService.createEntry({
      transactionId,
      account: 'ESCROW',
      debit: amount,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'SELLER_WALLET',
      debit: 0,
      credit: sellerAmount,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'PLATFORM_FEE',
      debit: 0,
      credit: fee,
    });

    // Outbox event
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ESCROW_RELEASED',
        aggregate_id: orderId,
        payload: {
          orderId,
          sellerId,
          amount: sellerAmount,
          fee,
          releasedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Escrow released ${sellerAmount} to seller ${sellerId}, fee ${fee}`);

    return { sellerAmount, platformFee: fee };
  }

  async refundFromEscrow(orderId: string, buyerId: string, amount: number): Promise<void> {
    const buyerWallet = await this.walletService.getWalletByUserId(buyerId);

    // Tambah saldo buyer (refund)
    await this.walletService.updateBalance(
      buyerWallet.id,
      amount,
      'CREDIT',
      'REFUND',
      orderId,
      `Refund from escrow for order ${orderId}`
    );

    // Journal entry
    const transactionId = `escrow_refund_${orderId}`;

    await this.journalService.createEntry({
      transactionId,
      account: 'ESCROW',
      debit: amount,
      credit: 0,
    });

    await this.journalService.createEntry({
      transactionId,
      account: 'BUYER_WALLET',
      debit: 0,
      credit: amount,
    });

    this.logger.log(`Escrow refund ${amount} to buyer ${buyerId} for order ${orderId}`);
  }

  async getEscrowBalance(): Promise<number> {
    const result = await this.journalService.getBalanceForAccount('ESCROW');
    return result.balance;
  }
}

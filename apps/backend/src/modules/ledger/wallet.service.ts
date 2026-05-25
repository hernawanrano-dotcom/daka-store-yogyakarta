import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType, TransactionReferenceType } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  async getWalletByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user: ${userId}`);
    }

    return wallet;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWalletByUserId(userId);
    return wallet.balance;
  }

  async updateBalance(
    walletId: string,
    amount: number,
    type: 'CREDIT' | 'DEBIT',
    referenceType?: TransactionReferenceType,
    referenceId?: string,
    description?: string
  ): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found: ${walletId}`);
    }

    let newBalance: number;

    if (type === 'CREDIT') {
      newBalance = wallet.balance + amount;
    } else {
      if (wallet.balance < amount) {
        throw new BadRequestException(
          `Insufficient balance. Current: ${wallet.balance}, Required: ${amount}`
        );
      }
      newBalance = wallet.balance - amount;
    }

    // Update wallet balance
    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    });

    // Record transaction
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        wallet_id: walletId,
        type: type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        amount,
        reference_type: referenceType || 'ORDER',
        reference_id: referenceId || '',
        description: description || null,
        balance_after: newBalance,
      },
    });

    // Simpan ke outbox untuk event
    const eventName = type === 'CREDIT' ? 'WALLET_CREDITED' : 'WALLET_DEBITED';

    await this.prisma.outboxMessage.create({
      data: {
        event_name: eventName,
        aggregate_id: walletId,
        payload: {
          walletId,
          userId: wallet.user_id,
          amount,
          balanceAfter: newBalance,
          referenceId,
          referenceType,
          timestamp: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Wallet ${walletId} ${type}d: ${amount}, new balance: ${newBalance}`);

    return newBalance;
  }

  async createWalletForUser(userId: string): Promise<void> {
    const existing = await this.prisma.wallet.findUnique({
      where: { user_id: userId },
    });

    if (existing) {
      this.logger.log(`Wallet already exists for user: ${userId}`);
      return;
    }

    await this.prisma.wallet.create({
      data: {
        user_id: userId,
        balance: 0,
      },
    });

    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'WALLET_CREATED',
        aggregate_id: userId,
        payload: {
          userId,
          createdAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Wallet created for user: ${userId}`);
  }

  async getTransactionHistory(walletId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { wallet_id: walletId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { wallet_id: walletId },
      }),
    ]);

    return {
      data: transactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

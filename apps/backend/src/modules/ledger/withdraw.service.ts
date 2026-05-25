import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './wallet.service';

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService
  ) {}

  async requestWithdraw(
    userId: string,
    amount: number,
    bankName: string,
    bankAccount: string,
    bankAccountName: string
  ) {
    const wallet = await this.walletService.getWalletByUserId(userId);

    const MIN_WITHDRAW = 50000;
    const MAX_WITHDRAW = 10000000;

    if (amount < MIN_WITHDRAW) {
      throw new BadRequestException(`Minimal withdraw Rp ${MIN_WITHDRAW.toLocaleString()}`);
    }

    if (amount > MAX_WITHDRAW) {
      throw new BadRequestException(`Maksimal withdraw Rp ${MAX_WITHDRAW.toLocaleString()}`);
    }

    if (wallet.balance < amount) {
      throw new BadRequestException(
        `Saldo tidak mencukupi. Saldo saat ini: Rp ${wallet.balance.toLocaleString()}`
      );
    }

    // Hold balance (kurangi dulu)
    await this.walletService.updateBalance(
      wallet.id,
      amount,
      'DEBIT',
      'WITHDRAW',
      undefined,
      `Withdraw request to ${bankName} - ${bankAccount}`
    );

    const withdraw = await this.prisma.withdraw.create({
      data: {
        user_id: userId,
        amount,
        bank_name: bankName,
        bank_account: bankAccount,
        bank_account_name: bankAccountName,
        status: 'PENDING',
      },
    });

    // Outbox event
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'WITHDRAW_REQUESTED',
        aggregate_id: withdraw.id,
        payload: {
          withdrawId: withdraw.id,
          userId,
          amount,
          bankAccount: `${bankName} - ${bankAccount}`,
          requestedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Withdraw requested: ${userId} - Rp ${amount}`);

    return withdraw;
  }

  async approveWithdraw(withdrawId: string, adminId: string) {
    const withdraw = await this.prisma.withdraw.findUnique({
      where: { id: withdrawId },
    });

    if (!withdraw) {
      throw new BadRequestException('Withdraw not found');
    }

    if (withdraw.status !== 'PENDING') {
      throw new BadRequestException(`Withdraw status is ${withdraw.status}, not PENDING`);
    }

    // Di sini nanti integrasi ke bank API
    // Untuk sekarang langsung complete

    const updated = await this.prisma.withdraw.update({
      where: { id: withdrawId },
      data: {
        status: 'COMPLETED',
        processed_by: adminId,
        processed_at: new Date(),
      },
    });

    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'WITHDRAW_COMPLETED',
        aggregate_id: withdrawId,
        payload: {
          withdrawId,
          userId: withdraw.user_id,
          amount: withdraw.amount,
          completedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Withdraw approved: ${withdrawId} by admin ${adminId}`);

    return updated;
  }

  async rejectWithdraw(withdrawId: string, adminId: string, reason: string) {
    const withdraw = await this.prisma.withdraw.findUnique({
      where: { id: withdrawId },
    });

    if (!withdraw) {
      throw new BadRequestException('Withdraw not found');
    }

    if (withdraw.status !== 'PENDING') {
      throw new BadRequestException(`Withdraw status is ${withdraw.status}, not PENDING`);
    }

    // Restore balance ke wallet
    const wallet = await this.walletService.getWalletByUserId(withdraw.user_id);

    await this.walletService.updateBalance(
      wallet.id,
      withdraw.amount,
      'CREDIT',
      'WITHDRAW',
      withdrawId,
      `Withdraw rejected: ${reason}`
    );

    const updated = await this.prisma.withdraw.update({
      where: { id: withdrawId },
      data: {
        status: 'REJECTED',
        processed_by: adminId,
        processed_at: new Date(),
        notes: reason,
      },
    });

    this.logger.log(`Withdraw rejected: ${withdrawId} by admin ${adminId}, reason: ${reason}`);

    return updated;
  }
}

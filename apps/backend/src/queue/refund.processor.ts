import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MidtransClient } from '../modules/payment/midtrans.client';
import { WalletService } from '../modules/ledger/wallet.service';
import { JournalService } from '../modules/ledger/journal.service';
import { Logger } from '@nestjs/common';

@Processor('payment.process.refund')
export class RefundProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundProcessor.name);

  constructor(
    private prisma: PrismaService,
    private midtrans: MidtransClient,
    private walletService: WalletService,
    private journalService: JournalService,
  ) {
    super();
  }

  async process(job: Job<{ refundId: string; paymentId: string; orderId: string; amount: number }>): Promise<any> {
    const { refundId, paymentId, orderId, amount } = job.data;

    this.logger.log(`Processing refund for order: ${orderId}, amount: ${amount}`);

    try {
      // 1. Panggil Midtrans refund API
      const refundResult = await this.midtrans.refund({
        paymentId,
        amount,
        reason: 'Customer dispute',
      });

      // 2. Update refund status
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
        },
      });

      // 3. Update payment status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED' },
      });

      // 4. Journal entry untuk refund
      const transactionId = `refund_${refundId}`;

      await this.journalService.createEntry({
        transactionId,
        account: 'PLATFORM_ESCROW',
        debit: amount,
        credit: 0,
      });

      await this.journalService.createEntry({
        transactionId,
        account: 'CUSTOMER_WALLET',
        debit: 0,
        credit: amount,
      });

      // 5. Outbox event
      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'PAYMENT_REFUNDED',
          aggregate_id: paymentId,
          payload: {
            paymentId,
            orderId,
            refundAmount: amount,
            refundedAt: new Date().toISOString(),
          },
          status: 'pending',
        },
      });

      this.logger.log(`Refund completed for order: ${orderId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Refund failed for order ${orderId}: ${error.message}`);

      // Update refund status to FAILED
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: 'FAILED', error_message: error.message },
      });

      throw error;
    }
  }
}
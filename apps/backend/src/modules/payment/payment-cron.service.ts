import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingPayments() {
    this.logger.log('Checking for expired pending payments...');

    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expired_at: { lt: new Date() },
      },
    });

    for (const payment of expiredPayments) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.EXPIRED },
      });

      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'PAYMENT_EXPIRED',
          aggregate_id: payment.id,
          payload: {
            paymentId: payment.id,
            orderId: payment.master_order_id,
            expiredAt: new Date().toISOString(),
          },
          status: 'pending',
        },
      });

      this.logger.log(`Expired payment: ${payment.id}`);
    }

    if (expiredPayments.length > 0) {
      this.logger.log(`Expired ${expiredPayments.length} payments`);
    }
  }
}

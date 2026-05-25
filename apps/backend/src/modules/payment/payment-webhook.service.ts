import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { PaymentStateMachine } from './payment.state-machine';
import { MidtransClient } from './midtrans.client';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private stateMachine: PaymentStateMachine,
    private midtrans: MidtransClient,
  ) {}

  async processWebhook(payload: any, signature: string): Promise<void> {
    // 1. Verifikasi signature
    const isValid = this.midtrans.verifySignature(payload, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const { order_id, transaction_status, transaction_id, gross_amount } = payload;

    // 2. Redis lock
    const lockKey = `lock:payment:process:${order_id}`;
    const lockAcquired = await this.redis.setnx(lockKey, 'locked', 30);

    if (!lockAcquired) {
      this.logger.warn(`Payment webhook already processing for order: ${order_id}`);
      return;
    }

    try {
      // 3. Idempotency key
      const idempotencyKey = `${order_id}_${transaction_status}`;
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existing) {
        this.logger.log(`Duplicate webhook for key: ${idempotencyKey}`);
        return;
      }

      // 4. Simpan idempotency key
      await this.prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          response_status: 200,
          response_body: { message: 'processed' },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // 5. Proses webhook
      if (transaction_status === 'settlement') {
        await this.handleSuccess(order_id, transaction_id, parseInt(gross_amount));
      } else if (transaction_status === 'expire') {
        await this.handleExpired(order_id);
      } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
        await this.handleFailed(order_id, `Payment ${transaction_status}`);
      }
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async handleSuccess(orderId: string, midtransId: string, amount: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { master_order_id: orderId, midtrans_id: midtransId },
    });

    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return;
    }

    await this.stateMachine.transition(payment.id, PaymentStatus.SUCCESS);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { paid_at: new Date() },
    });

    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'PAYMENT_SUCCESS',
        aggregate_id: payment.id,
        payload: {
          paymentId: payment.id,
          orderId: orderId,
          amount: amount,
          paidAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Payment success for order: ${orderId}`);
  }

  private async handleExpired(orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { master_order_id: orderId },
    });

    if (payment && payment.status === PaymentStatus.PENDING) {
      await this.stateMachine.transition(payment.id, PaymentStatus.EXPIRED);

      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'PAYMENT_EXPIRED',
          aggregate_id: payment.id,
          payload: {
            paymentId: payment.id,
            orderId: orderId,
            expiredAt: new Date().toISOString(),
          },
          status: 'pending',
        },
      });
    }
  }

  private async handleFailed(orderId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { master_order_id: orderId },
    });

    if (payment && payment.status === PaymentStatus.PENDING) {
      await this.stateMachine.transition(payment.id, PaymentStatus.FAILED);

      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'PAYMENT_FAILED',
          aggregate_id: payment.id,
          payload: {
            paymentId: payment.id,
            orderId: orderId,
            reason: reason,
            failedAt: new Date().toISOString(),
          },
          status: 'pending',
        },
      });
    }
  }
}
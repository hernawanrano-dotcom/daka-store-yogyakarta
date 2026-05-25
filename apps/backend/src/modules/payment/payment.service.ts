import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStateMachine } from './payment.state-machine';
import { MidtransClient } from './midtrans.client';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private stateMachine: PaymentStateMachine,
    private midtrans: MidtransClient,
  ) {}

  async findById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async createPayment(orderId: string, method: PaymentMethod, amount: number, buyerEmail: string) {
    // Cek apakah payment sudah ada
    const existing = await this.prisma.payment.findFirst({
      where: { master_order_id: orderId },
    });

    if (existing) {
      throw new BadRequestException('Payment already exists for this order');
    }

    // Hit expired_at (24 jam dari sekarang)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 24);

    // Panggil Midtrans
    const midtransResult = await this.midtrans.createTransaction({
      orderId,
      amount,
      buyerEmail,
    });

    // Simpan ke database dengan status PENDING
    const payment = await this.prisma.payment.create({
      data: {
        master_order_id: orderId,
        amount,
        method,
        status: PaymentStatus.PENDING,
        midtrans_id: midtransResult.transactionId,
        midtrans_response: midtransResult,
        expired_at: expiredAt,
      },
    });

    return {
      paymentId: payment.id,
      paymentUrl: midtransResult.redirectUrl,
      token: midtransResult.token,
    };
  }

  async handleWebhook(payload: any, signature: string) {
    // 1. Verifikasi signature
    const isValid = this.midtrans.verifySignature(payload, signature);
    if (!isValid) {
      this.logger.error('Invalid signature from Midtrans');
      throw new BadRequestException('Invalid signature');
    }

    const { order_id, transaction_status, payment_type, transaction_id, gross_amount } = payload;

    // 2. Idempotency key
    const idempotencyKey = `${order_id}_${transaction_status}`;
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      this.logger.log(`Duplicate webhook for key: ${idempotencyKey}`);
      return;
    }

    // 3. Simpan idempotency key
    await this.prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        response_status: 200,
        response_body: { message: 'processed' },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 4. Proses berdasarkan status
    if (transaction_status === 'settlement') {
      await this.handlePaymentSuccess(order_id, transaction_id, parseInt(gross_amount));
    } else if (transaction_status === 'pending') {
      this.logger.log(`Payment pending for order: ${order_id}`);
    } else if (transaction_status === 'expire') {
      await this.handlePaymentExpired(order_id);
    } else if (transaction_status === 'cancel') {
      await this.handlePaymentFailed(order_id, 'User cancelled payment');
    } else if (transaction_status === 'deny') {
      await this.handlePaymentFailed(order_id, 'Payment denied by bank');
    }
  }

  private async handlePaymentSuccess(orderId: string, midtransId: string, amount: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { master_order_id: orderId, midtrans_id: midtransId },
    });

    if (!payment) {
      this.logger.error(`Payment not found for order: ${orderId}`);
      return;
    }

    // Update status payment
    await this.stateMachine.transition(payment.id, PaymentStatus.SUCCESS);

    // Update paid_at
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { paid_at: new Date() },
    });

    // Save ke outbox (bukan publish langsung!)
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

  private async handlePaymentExpired(orderId: string) {
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

  private async handlePaymentFailed(orderId: string, reason: string) {
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
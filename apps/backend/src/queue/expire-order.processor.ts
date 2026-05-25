import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Processor('order.expire.pending')
export class ExpireOrderProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpireOrderProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log('Running expire pending orders check...');

    const now = new Date();

    const expiredOrders = await this.prisma.masterOrder.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        expires_at: { lt: now },
      },
    });

    this.logger.log(`Found ${expiredOrders.length} expired orders`);

    for (const order of expiredOrders) {
      await this.expireOrder(order.id);
    }

    return { expired: expiredOrders.length };
  }

  private async expireOrder(orderId: string) {
    await this.prisma.masterOrder.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAYMENT_EXPIRED,
        cancelled_at: new Date(),
      },
    });

    await this.prisma.subOrder.updateMany({
      where: { master_order_id: orderId },
      data: {
        status: OrderStatus.PAYMENT_EXPIRED,
        cancelled_at: new Date(),
      },
    });

    // Restore stock
    const holds = await this.prisma.orderHoldStock.findMany({
      where: { order_id: orderId },
    });

    for (const hold of holds) {
      await this.prisma.product.update({
        where: { id: hold.product_id },
        data: { stock: { increment: hold.quantity } },
      });
    }

    await this.prisma.orderHoldStock.deleteMany({
      where: { order_id: orderId },
    });

    // Outbox event
    await this.prisma.outboxMessage.create({
      data: {
        event_name: 'ORDER_CANCELLED',
        aggregate_id: orderId,
        payload: {
          orderId,
          reason: 'Payment expired',
          cancelledAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    this.logger.log(`Expired order: ${orderId}`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderCronService {
  private readonly logger = new Logger(OrderCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingPayments() {
    this.logger.log('Checking for expired pending payments...');

    const now = new Date();

    const expiredOrders = await this.prisma.masterOrder.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        expires_at: { lt: now },
      },
    });

    for (const order of expiredOrders) {
      await this.prisma.masterOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAYMENT_EXPIRED,
          cancelled_at: now,
        },
      });

      await this.prisma.subOrder.updateMany({
        where: { master_order_id: order.id },
        data: {
          status: OrderStatus.PAYMENT_EXPIRED,
          cancelled_at: now,
        },
      });

      // Restore stock
      const holds = await this.prisma.orderHoldStock.findMany({
        where: { order_id: order.id },
      });

      for (const hold of holds) {
        await this.prisma.product.update({
          where: { id: hold.product_id },
          data: { stock: { increment: hold.quantity } },
        });
      }

      await this.prisma.orderHoldStock.deleteMany({
        where: { order_id: order.id },
      });

      this.logger.log(`Expired order: ${order.id}`);
    }

    if (expiredOrders.length > 0) {
      this.logger.log(`Expired ${expiredOrders.length} pending orders`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCompleteDeliveredOrders() {
    this.logger.log('Auto-completing delivered orders...');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deliveredOrders = await this.prisma.subOrder.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        delivered_at: { lt: sevenDaysAgo },
      },
    });

    for (const order of deliveredOrders) {
      await this.prisma.subOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
        },
      });

      await this.prisma.orderStatusHistory.create({
        data: {
          sub_order_id: order.id,
          status: OrderStatus.COMPLETED,
          note: 'Auto-completed after 7 days',
        },
      });

      // Check master order completion
      const masterSubOrders = await this.prisma.subOrder.findMany({
        where: { master_order_id: order.master_order_id },
      });

      const allCompleted = masterSubOrders.every((so) => so.status === OrderStatus.COMPLETED);

      if (allCompleted) {
        await this.prisma.masterOrder.update({
          where: { id: order.master_order_id },
          data: {
            status: OrderStatus.COMPLETED,
            completed_at: new Date(),
          },
        });

        await this.prisma.outboxMessage.create({
          data: {
            event_name: 'ORDER_COMPLETED',
            aggregate_id: order.master_order_id,
            payload: {
              orderId: order.master_order_id,
              completedAt: new Date().toISOString(),
            },
            status: 'pending',
          },
        });
      }

      this.logger.log(`Auto-completed order: ${order.id}`);
    }

    if (deliveredOrders.length > 0) {
      this.logger.log(`Auto-completed ${deliveredOrders.length} orders`);
    }
  }
}
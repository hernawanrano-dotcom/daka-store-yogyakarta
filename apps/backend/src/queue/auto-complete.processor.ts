import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Processor('order.complete.auto')
export class AutoCompleteProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoCompleteProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log('Running auto-complete check...');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deliveredOrders = await this.prisma.subOrder.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        delivered_at: { lt: sevenDaysAgo },
      },
    });

    this.logger.log(`Found ${deliveredOrders.length} orders to auto-complete`);

    for (const order of deliveredOrders) {
      await this.completeOrder(order.id);
    }

    return { completed: deliveredOrders.length };
  }

  private async completeOrder(subOrderId: string) {
    const subOrder = await this.prisma.subOrder.findUnique({
      where: { id: subOrderId },
    });

    if (!subOrder) return;

    await this.prisma.subOrder.update({
      where: { id: subOrderId },
      data: {
        status: OrderStatus.COMPLETED,
      },
    });

    // Save history
    await this.prisma.orderStatusHistory.create({
      data: {
        sub_order_id: subOrderId,
        status: OrderStatus.COMPLETED,
        note: 'Auto-completed after 7 days',
      },
    });

    // Check if all sub orders completed
    const masterSubOrders = await this.prisma.subOrder.findMany({
      where: { master_order_id: subOrder.master_order_id },
    });

    const allCompleted = masterSubOrders.every((so) => so.status === OrderStatus.COMPLETED);

    if (allCompleted) {
      await this.prisma.masterOrder.update({
        where: { id: subOrder.master_order_id },
        data: {
          status: OrderStatus.COMPLETED,
          completed_at: new Date(),
        },
      });

      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'ORDER_COMPLETED',
          aggregate_id: subOrder.master_order_id,
          payload: {
            orderId: subOrder.master_order_id,
            completedAt: new Date().toISOString(),
          },
          status: 'pending',
        },
      });
    }

    this.logger.log(`Auto-completed order: ${subOrderId}`);
  }
}
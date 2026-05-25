import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderEvents } from '@daka/shared-events'; // ✅ SUDAH BENAR

@Injectable()
export class ReviewEventHandler {
  private readonly logger = new Logger(ReviewEventHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent(OrderEvents.ORDER_COMPLETED)
  async handleOrderCompleted(payload: { orderId: string; subOrderId?: string }) {
    this.logger.log(`Order ${payload.orderId} completed - buyer can now review products`);
  }

  async canReview(userId: string, orderId: string, productId: string): Promise<boolean> {
    const subOrder = await this.prisma.subOrder.findFirst({
      where: {
        id: orderId,
        buyerId: userId,
        status: 'COMPLETED',
      },
    });

    if (!subOrder) {
      return false;
    }

    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        subOrderId: orderId,
        productId,
      },
    });

    if (!orderItem) {
      return false;
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        userId,
        productId,
        subOrderId: orderId,
      },
    });

    return !existingReview;
  }
}

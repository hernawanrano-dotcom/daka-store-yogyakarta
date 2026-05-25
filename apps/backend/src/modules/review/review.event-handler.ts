import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderEvents } from '@daka/shared-events';

@Injectable()
export class ReviewEventHandler {
  private readonly logger = new Logger(ReviewEventHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * When order is completed, buyer can review the products
   * This just logs that the order is ready for review
   * Actual review creation is triggered by user via API
   */
  @OnEvent(OrderEvents.ORDER_COMPLETED)
  async handleOrderCompleted(payload: { orderId: string; subOrderId?: string }) {
    this.logger.log(`Order ${payload.orderId} completed - buyer can now review products`);

    // Optional: Send notification to buyer asking for review
    // This would be handled by AI-6 Notification module
  }

  /**
   * Check if user can review a specific product from an order
   * Called by ReviewService.create() to validate
   */
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
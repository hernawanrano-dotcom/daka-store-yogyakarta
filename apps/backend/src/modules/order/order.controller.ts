import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderService, CheckoutDto } from './order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, OrderStatus } from '@prisma/client';

interface RequestWithUser extends Request {
  user?: { id: string; email: string; role: string };
}

interface UpdateOrderStatusDto {
  status: OrderStatus;
  trackingNumber?: string;
  courierName?: string;
}

interface CancelOrderDto {
  reason: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private orderService: OrderService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /api/v1/orders
   * Get all orders for current user (buyer)
   */
  @Get()
  async getMyOrders(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const result = await this.orderService.getUserOrders(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status,
    );

    return {
      success: true,
      message: 'Orders retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  /**
   * GET /api/v1/orders/:id
   * Get order detail by ID
   */
  @Get(':id')
  async getOrderById(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user?.id;
    const order = await this.orderService.getOrderById(id, userId);

    return {
      success: true,
      message: 'Order detail retrieved successfully',
      data: order,
    };
  }

  /**
   * POST /api/v1/orders/checkout
   * Checkout: convert cart to order
   */
  @Post('checkout')
  async checkout(
    @Req() req: RequestWithUser,
    @Body() dto: CheckoutDto,
    @Query('sessionId') sessionId?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const result = await this.orderService.checkout(userId, dto, sessionId);

    return {
      success: true,
      message: 'Order created successfully',
      data: result,
    };
  }

  /**
   * POST /api/v1/orders/payment-callback
   * Callback dari payment service setelah pembayaran sukses
   */
  @Post('payment-callback')
  async paymentCallback(@Body() body: { orderId: string; paymentId: string; status: string; paidAt: string; amount?: number }) {
    const { orderId, paymentId, status, paidAt, amount } = body;

    if (status === 'SUCCESS') {
      // Update order status to PAID
      await this.prisma.masterOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(paidAt),
          paymentId,
        },
      });

      await this.prisma.subOrder.updateMany({
        where: { masterOrderId: orderId },
        data: {
          status: OrderStatus.PAID,
        },
      });

      // Publish ORDER_PAID event via outbox
      await this.prisma.outboxMessage.create({
        data: {
          eventName: 'ORDER_PAID',
          aggregateId: orderId,
          payload: {
            orderId,
            paymentId,
            paidAmount: amount,
            paidAt,
          },
          status: 'pending',
        },
      });
    }

    return {
      success: true,
      message: 'Payment callback processed',
      data: null,
    };
  }

  /**
   * POST /api/v1/orders/:id/cancel
   * Cancel order (before payment)
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    await this.orderService.cancelOrder(id, userId, dto.reason);

    return {
      success: true,
      message: 'Order cancelled successfully',
      data: null,
    };
  }

  /**
   * POST /api/v1/orders/:id/complete
   * Mark order as received (complete)
   */
  @Post(':id/complete')
  async completeOrder(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    await this.orderService.completeOrder(id, userId);

    return {
      success: true,
      message: 'Order completed successfully',
      data: null,
    };
  }

  // ==================== SELLER ENDPOINTS ====================

  /**
   * GET /api/v1/seller/orders
   * Get orders for seller
   */
  @Get('seller/orders')
  @Roles(UserRole.seller, UserRole.admin)
  @UseGuards(RolesGuard)
  async getSellerOrders(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const result = await this.orderService.getSellerOrders(
      sellerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status,
    );

    return {
      success: true,
      message: 'Seller orders retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  /**
   * PUT /api/v1/seller/orders/:subOrderId/status
   * Update sub-order status (seller only)
   */
  @Put('seller/orders/:subOrderId/status')
  @Roles(UserRole.seller, UserRole.admin)
  @UseGuards(RolesGuard)
  async updateSubOrderStatus(
    @Req() req: RequestWithUser,
    @Param('subOrderId') subOrderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    await this.orderService.updateSubOrderStatus(
      subOrderId,
      sellerId,
      dto.status,
      dto.trackingNumber,
      dto.courierName,
    );

    return {
      success: true,
      message: 'Order status updated successfully',
      data: { status: dto.status },
    };
  }
}
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CartService } from '../cart/cart.service';
import { OrderStatus, Prisma } from '@prisma/client';

export interface CheckoutDto {
  addressId: string;
  courierName: string;
  courierService: string;
  shippingFee: number;
  paymentMethod: string;
  voucherCode?: string;
}

export interface OrderItemDetail {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image: string;
}

export interface SubOrderDetail {
  id: string;
  sellerId: string;
  sellerName: string;
  items: OrderItemDetail[];
  totalAmount: number;
  shippingFee: number;
  grandTotal: number;
  status: OrderStatus;
  courierName?: string;
  trackingNumber?: string;
  createdAt: Date;
}

export interface OrderDetail {
  id: string;
  buyerId: string;
  buyerName: string;
  address: {
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
    postalCode: string;
  };
  subOrders: SubOrderDetail[];
  totalAmount: number;
  shippingFee: number;
  platformFee: number;
  discountAmount: number;
  voucherCode?: string;
  grandTotal: number;
  status: OrderStatus;
  paymentId?: string;
  paymentMethod?: string;
  paidAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly ORDER_EXPIRY_MINUTES = 1440; // 24 jam

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private cartService: CartService,
  ) {}

  /**
   * Checkout: konversi cart ke MasterOrder + SubOrders
   */
  async checkout(
    userId: string,
    dto: CheckoutDto,
    sessionId?: string,
  ): Promise<any> {
    // 1. Get cart items
    const cartItems = await this.cartService.getCartItemsForCheckout(userId, sessionId);
    
    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Group items by seller
    const itemsBySeller = await this.groupItemsBySeller(cartItems);
    
    // 3. Validate stock
    await this.validateStock(itemsBySeller);
    
    // 4. Validate voucher
    let discountAmount = 0;
    if (dto.voucherCode) {
      discountAmount = await this.validateVoucher(dto.voucherCode, userId, cartItems);
    }

    // 5. Calculate totals
    const subOrdersData: any[] = [];
    let totalAmount = 0;
    let totalShippingFee = 0;

    for (const [sellerId, items] of itemsBySeller) {
      const subTotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
      const subShippingFee = this.calculateShippingFee(items, dto);
      const subGrandTotal = subTotal + subShippingFee;
      
      subOrdersData.push({
        sellerId,
        items,
        totalAmount: subTotal,
        shippingFee: subShippingFee,
        grandTotal: subGrandTotal,
      });
      
      totalAmount += subTotal;
      totalShippingFee += subShippingFee;
    }

    const platformFee = this.calculatePlatformFee(totalAmount);
    const grandTotal = totalAmount + totalShippingFee + platformFee - discountAmount;

    // 6. Create order with transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findUnique({
        where: { id: dto.addressId, userId },
      });
      
      if (!address) {
        throw new BadRequestException('Address not found');
      }

      const masterOrder = await tx.masterOrder.create({
        data: {
          buyerId: userId,
          addressId: dto.addressId,
          totalAmount,
          shippingFee: totalShippingFee,
          platformFee,
          discountAmount,
          voucherCode: dto.voucherCode,
          grandTotal,
          paymentMethod: dto.paymentMethod as any,
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt: new Date(Date.now() + this.ORDER_EXPIRY_MINUTES * 60 * 1000),
        },
      });

      const subOrders = [];
      for (const sub of subOrdersData) {
        const subOrder = await tx.subOrder.create({
          data: {
            masterOrderId: masterOrder.id,
            sellerId: sub.sellerId,
            destinationAddressId: dto.addressId,
            courierName: dto.courierName as any,
            courierService: dto.courierService,
            shippingFee: sub.shippingFee,
            totalAmount: sub.totalAmount,
            discountAmount: 0,
            grandTotal: sub.grandTotal,
            status: OrderStatus.PENDING_PAYMENT,
          },
        });

        for (const item of sub.items) {
          await tx.orderItem.create({
            data: {
              subOrderId: subOrder.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
            },
          });
        }

        subOrders.push(subOrder);
      }

      await this.holdStock(tx, masterOrder.id, itemsBySeller);
      await this.cartService.clearUserCart(userId);

      return { masterOrder, subOrders };
    });

    // 7. Publish event: ORDER_CREATED
    await this.publishOrderCreatedEvent(result.masterOrder.id);

    // 8. Get buyer details for payment
    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    // 9. Create payment via payment service
    const paymentUrl = await this.createPayment(
      result.masterOrder.id,
      grandTotal,
      dto.paymentMethod,
      userId,
      buyer?.email || '',
      buyer?.fullName || '',
    );

    return {
      orderId: result.masterOrder.id,
      grandTotal,
      paymentUrl,
      expiresAt: result.masterOrder.expiresAt,
    };
  }

  /**
   * Create payment via payment service (AI-3)
   */
  private async createPayment(
    orderId: string,
    amount: number,
    paymentMethod: string,
    buyerId: string,
    buyerEmail: string,
    buyerName: string,
  ): Promise<string> {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${paymentServiceUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount,
          method: paymentMethod,
          buyerId,
          buyerEmail,
          buyerName,
          callbackUrl: `${process.env.APP_URL}/api/v1/orders/payment-callback`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.paymentUrl;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      return `https://midtrans.com/pay/${orderId}`;
    }
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus,
  ): Promise<any> {
    const where: any = { buyerId: userId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.masterOrder.findMany({
        where,
        include: {
          subOrders: {
            include: {
              seller: {
                select: { id: true, fullName: true },
              },
              items: {
                include: {
                  product: {
                    select: { id: true, name: true, images: true },
                  },
                  variant: true,
                },
              },
            },
          },
          address: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.masterOrder.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => this.formatOrderDetail(order));

    return {
      data: formattedOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get order detail by ID
   */
  async getOrderById(orderId: string, userId?: string): Promise<OrderDetail> {
    const order = await this.prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          select: { id: true, fullName: true, email: true },
        },
        address: true,
        subOrders: {
          include: {
            seller: {
              select: { id: true, fullName: true },
            },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, images: true },
                },
                variant: true,
              },
            },
            shipment: true,
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (userId && order.buyerId !== userId) {
      const isSeller = order.subOrders.some((so) => so.sellerId === userId);
      if (!isSeller) {
        throw new BadRequestException('You do not have permission to view this order');
      }
    }

    return this.formatOrderDetail(order);
  }

  /**
   * Cancel order (before payment)
   */
  async cancelOrder(orderId: string, userId: string, reason: string): Promise<void> {
    const order = await this.prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { subOrders: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== userId) {
      throw new BadRequestException('You are not the owner of this order');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.masterOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.subOrder.updateMany({
        where: { masterOrderId: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await this.releaseStock(tx, orderId);
    });

    await this.publishOrderCancelledEvent(orderId, reason);
  }

  /**
   * Seller update sub-order status
   */
  async updateSubOrderStatus(
    subOrderId: string,
    sellerId: string,
    status: OrderStatus,
    trackingNumber?: string,
    courierName?: string,
  ): Promise<void> {
    const subOrder = await this.prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { masterOrder: true },
    });

    if (!subOrder) {
      throw new NotFoundException('Sub-order not found');
    }

    if (subOrder.sellerId !== sellerId) {
      throw new BadRequestException('You are not the seller of this order');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [],
      [OrderStatus.PAYMENT_EXPIRED]: [],
      [OrderStatus.PAID]: [OrderStatus.READY_TO_SHIP],
      [OrderStatus.READY_TO_SHIP]: [OrderStatus.IN_TRANSIT],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCEL_REQUESTED]: [OrderStatus.CANCELLED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUND_REQUESTED]: [OrderStatus.REFUND_APPROVED],
      [OrderStatus.REFUND_APPROVED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.FAILED]: [],
    };

    const allowed = validTransitions[subOrder.status]?.includes(status);
    if (!allowed && subOrder.status !== status) {
      throw new BadRequestException(
        `Invalid transition from ${subOrder.status} to ${status}`,
      );
    }

    const updateData: any = { status };

    if (status === OrderStatus.IN_TRANSIT && trackingNumber) {
      updateData.trackingNumber = trackingNumber;
      updateData.courierName = courierName;
      updateData.shippedAt = new Date();
      await this.publishOrderShippedEvent(subOrder.masterOrderId, trackingNumber, courierName);
    }

    if (status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
      await this.publishOrderDeliveredEvent(subOrder.masterOrderId);
    }

    if (status === OrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
      await this.publishOrderCompletedEvent(subOrder.masterOrderId);
    }

    await this.prisma.subOrder.update({
      where: { id: subOrderId },
      data: updateData,
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        subOrderId,
        status,
        note: `Status updated by seller`,
        createdBy: sellerId,
      },
    });

    await this.checkAndUpdateMasterOrderStatus(subOrder.masterOrderId);
  }

  /**
   * Mark order as received by buyer (complete)
   */
  async completeOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.masterOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== userId) {
      throw new BadRequestException('You are not the owner of this order');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Order cannot be completed at this stage');
    }

    await this.prisma.subOrder.updateMany({
      where: { masterOrderId: orderId, status: OrderStatus.DELIVERED },
      data: {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await this.checkAndUpdateMasterOrderStatus(orderId);
    await this.publishOrderCompletedEvent(orderId);
  }

  /**
   * Cron job: Auto complete orders 7 days after delivery
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCompleteOrdersCron() {
    this.logger.log('Running auto-complete orders cron job');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deliveredSubOrders = await this.prisma.subOrder.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        deliveredAt: { lte: sevenDaysAgo },
      },
    });

    this.logger.log(`Found ${deliveredSubOrders.length} orders to auto-complete`);

    for (const subOrder of deliveredSubOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subOrder.update({
            where: { id: subOrder.id },
            data: {
              status: OrderStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              subOrderId: subOrder.id,
              status: OrderStatus.COMPLETED,
              note: 'Auto-completed after 7 days',
              createdBy: 'system',
            },
          });
        });

        await this.checkAndUpdateMasterOrderStatus(subOrder.masterOrderId);
        await this.publishOrderCompletedEvent(subOrder.masterOrderId);
        this.logger.log(`Auto-completed sub-order ${subOrder.id}`);
      } catch (error) {
        this.logger.error(`Failed to auto-complete sub-order ${subOrder.id}: ${error.message}`);
      }
    }
  }

  /**
   * Cron job: Expire pending payments every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingOrders() {
    this.logger.log('Running expire pending orders cron job');

    const expiredOrders = await this.prisma.masterOrder.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Found ${expiredOrders.length} expired orders to cancel`);

    for (const order of expiredOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.masterOrder.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAYMENT_EXPIRED,
              cancelledAt: new Date(),
            },
          });

          await tx.subOrder.updateMany({
            where: { masterOrderId: order.id },
            data: {
              status: OrderStatus.PAYMENT_EXPIRED,
              cancelledAt: new Date(),
            },
          });

          await this.releaseStock(tx, order.id);
        });

        await this.publishOrderCancelledEvent(order.id, 'Payment expired');
        this.logger.log(`Expired order ${order.id} cancelled`);
      } catch (error) {
        this.logger.error(`Failed to expire order ${order.id}: ${error.message}`);
      }
    }
  }

  /**
   * Get orders for seller
   */
  async getSellerOrders(
    sellerId: string,
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus,
  ): Promise<any> {
    const where: any = { sellerId };
    if (status) {
      where.status = status;
    }

    const [subOrders, total] = await Promise.all([
      this.prisma.subOrder.findMany({
        where,
        include: {
          masterOrder: {
            include: {
              buyer: {
                select: { id: true, fullName: true },
              },
              address: true,
            },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, images: true },
              },
              variant: true,
            },
          },
          shipment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subOrder.count({ where }),
    ]);

    const formattedOrders = subOrders.map((subOrder) => ({
      id: subOrder.id,
      masterOrderId: subOrder.masterOrderId,
      buyerName: subOrder.masterOrder.buyer.fullName,
      address: subOrder.masterOrder.address,
      items: subOrder.items.map((item) => ({
        productName: item.product.name,
        variantName: item.variant?.name,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        image: item.product.images?.[0],
      })),
      totalAmount: subOrder.totalAmount,
      shippingFee: subOrder.shippingFee,
      grandTotal: subOrder.grandTotal,
      status: subOrder.status,
      courierName: subOrder.courierName,
      trackingNumber: subOrder.trackingNumber,
      createdAt: subOrder.createdAt,
    }));

    return {
      data: formattedOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private async groupItemsBySeller(cartItems: any[]): Promise<Map<string, any[]>> {
    const productIds = cartItems.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellerId: true, name: true },
    });

    const productSellerMap = new Map(products.map((p) => [p.id, p.sellerId]));
    const itemsBySeller = new Map<string, any[]>();

    for (const item of cartItems) {
      const sellerId = productSellerMap.get(item.productId);
      if (!sellerId) continue;

      if (!itemsBySeller.has(sellerId)) {
        itemsBySeller.set(sellerId, []);
      }
      itemsBySeller.get(sellerId)!.push(item);
    }

    return itemsBySeller;
  }

  private async validateStock(itemsBySeller: Map<string, any[]>): Promise<void> {
    for (const [_, items] of itemsBySeller) {
      for (const item of items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });

        if (!product || !product.isActive) {
          throw new BadRequestException(`Product ${item.productName} is not available`);
        }

        const variant = item.variantId
          ? product.variants.find((v) => v.id === item.variantId)
          : null;

        const availableStock = variant ? variant.stock : product.stock;

        if (item.quantity > availableStock) {
          throw new BadRequestException(
            `Insufficient stock for ${item.productName}. Available: ${availableStock}`,
          );
        }
      }
    }
  }

  private async validateVoucher(code: string, userId: string, cartItems: any[]): Promise<number> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code, isActive: true },
    });

    if (!voucher) {
      throw new BadRequestException('Invalid voucher code');
    }

    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new BadRequestException('Voucher is not active');
    }

    const totalAmount = cartItems.reduce((sum, i) => sum + i.totalPrice, 0);
    if (totalAmount < voucher.minSpend) {
      throw new BadRequestException(`Minimum spend for this voucher is ${voucher.minSpend}`);
    }

    let discount = 0;
    if (voucher.discountType === 'PERCENTAGE') {
      discount = Math.floor(totalAmount * voucher.discountValue / 100);
      if (voucher.maxDiscount && discount > voucher.maxDiscount) {
        discount = voucher.maxDiscount;
      }
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      discount = voucher.discountValue;
    }

    return discount;
  }

  private calculateShippingFee(items: any[], dto: CheckoutDto): number {
    return dto.shippingFee;
  }

  private calculatePlatformFee(amount: number): number {
    const feePercentage = 3;
    let fee = Math.floor(amount * feePercentage / 100);
    const minFee = 1000;
    const maxFee = 50000;
    if (fee < minFee) fee = minFee;
    if (fee > maxFee) fee = maxFee;
    return fee;
  }

  private async holdStock(tx: Prisma.TransactionClient, orderId: string, itemsBySeller: Map<string, any[]>): Promise<void> {
    for (const [_, items] of itemsBySeller) {
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        await tx.orderHoldStock.create({
          data: {
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            expiresAt: new Date(Date.now() + this.ORDER_EXPIRY_MINUTES * 60 * 1000),
          },
        });
      }
    }
  }

  private async releaseStock(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const holds = await tx.orderHoldStock.findMany({
      where: { orderId },
    });

    for (const hold of holds) {
      await tx.product.update({
        where: { id: hold.productId },
        data: { stock: { increment: hold.quantity } },
      });
    }

    await tx.orderHoldStock.deleteMany({
      where: { orderId },
    });
  }

  private async checkAndUpdateMasterOrderStatus(masterOrderId: string): Promise<void> {
    const subOrders = await this.prisma.subOrder.findMany({
      where: { masterOrderId },
    });

    const allCompleted = subOrders.every((so) => so.status === OrderStatus.COMPLETED);
    const allCancelled = subOrders.every((so) => so.status === OrderStatus.CANCELLED);
    const anyDelivered = subOrders.some((so) => so.status === OrderStatus.DELIVERED);
    const anyInTransit = subOrders.some((so) => so.status === OrderStatus.IN_TRANSIT);
    const anyReadyToShip = subOrders.some((so) => so.status === OrderStatus.READY_TO_SHIP);

    let newStatus: OrderStatus = OrderStatus.PAID;

    if (allCompleted) {
      newStatus = OrderStatus.COMPLETED;
    } else if (allCancelled) {
      newStatus = OrderStatus.CANCELLED;
    } else if (anyDelivered) {
      newStatus = OrderStatus.DELIVERED;
    } else if (anyInTransit) {
      newStatus = OrderStatus.IN_TRANSIT;
    } else if (anyReadyToShip) {
      newStatus = OrderStatus.READY_TO_SHIP;
    }

    await this.prisma.masterOrder.update({
      where: { id: masterOrderId },
      data: { status: newStatus },
    });
  }

  // ==================== EVENT PUBLISHERS ====================

  private async publishOrderCreatedEvent(orderId: string): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_CREATED',
        aggregateId: orderId,
        payload: { orderId, createdAt: new Date().toISOString() },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_CREATED event queued for order ${orderId}`);
  }

  private async publishOrderPaidEvent(orderId: string, paymentId: string, paymentData: any): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_PAID',
        aggregateId: orderId,
        payload: {
          orderId,
          paymentId,
          paidAmount: paymentData.amount,
          paidAt: paymentData.paidAt,
        },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_PAID event queued for order ${orderId}`);
  }

  private async publishOrderShippedEvent(orderId: string, trackingNumber: string, courierName?: string): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_SHIPPED',
        aggregateId: orderId,
        payload: { orderId, trackingNumber, courierName, shippedAt: new Date().toISOString() },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_SHIPPED event queued for order ${orderId}`);
  }

  private async publishOrderDeliveredEvent(orderId: string): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_DELIVERED',
        aggregateId: orderId,
        payload: { orderId, deliveredAt: new Date().toISOString() },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_DELIVERED event queued for order ${orderId}`);
  }

  private async publishOrderCompletedEvent(orderId: string): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_COMPLETED',
        aggregateId: orderId,
        payload: { orderId, completedAt: new Date().toISOString() },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_COMPLETED event queued for order ${orderId}`);
  }

  private async publishOrderCancelledEvent(orderId: string, reason: string): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName: 'ORDER_CANCELLED',
        aggregateId: orderId,
        payload: { orderId, reason, cancelledAt: new Date().toISOString() },
        status: 'pending',
      },
    });
    this.logger.log(`ORDER_CANCELLED event queued for order ${orderId}`);
  }

  private formatOrderDetail(order: any): OrderDetail {
    return {
      id: order.id,
      buyerId: order.buyerId,
      buyerName: order.buyer?.fullName || '',
      address: {
        recipientName: order.address?.recipientName || '',
        phone: order.address?.phone || '',
        addressLine: order.address?.addressLine || '',
        city: order.address?.city || '',
        postalCode: order.address?.postalCode || '',
      },
      subOrders: order.subOrders.map((so: any) => ({
        id: so.id,
        sellerId: so.sellerId,
        sellerName: so.seller?.fullName || '',
        items: so.items.map((item: any) => ({
          productId: item.productId,
          productName: item.product?.name || '',
          variantId: item.variantId,
          variantName: item.variant?.name,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          image: item.product?.images?.[0] || '/placeholder.png',
        })),
        totalAmount: so.totalAmount,
        shippingFee: so.shippingFee,
        grandTotal: so.grandTotal,
        status: so.status,
        courierName: so.courierName || undefined,
        trackingNumber: so.trackingNumber || undefined,
        createdAt: so.createdAt,
      })),
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      platformFee: order.platformFee,
      discountAmount: order.discountAmount,
      voucherCode: order.voucherCode || undefined,
      grandTotal: order.grandTotal,
      status: order.status,
      paymentId: order.payment?.id,
      paymentMethod: order.payment?.method,
      paidAt: order.payment?.paidAt || undefined,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
    };
  }
}
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CreateFlashSaleDTO {
  name: string;
  slug: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  items: CreateFlashSaleItemDTO[];
}

export interface CreateFlashSaleItemDTO {
  productId: string;
  variantId?: string;
  flashPrice: number;
  flashStock: number;
  perUserLimit: number;
}

export interface BuyFlashSaleDTO {
  flashSaleId: string;
  itemId: string;
  userId: string;
  quantity: number;
}

@Injectable()
export class FlashSaleService {
  private readonly logger = new Logger(FlashSaleService.name);
  private readonly FLASH_SALE_STOCK_PREFIX = 'flashsale:stock:';
  private readonly FLASH_SALE_USER_PREFIX = 'flashsale:user:';

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('flash-sale.start') private startQueue: Queue,
    @InjectQueue('flash-sale.end') private endQueue: Queue,
  ) {}

  async createFlashSale(data: CreateFlashSaleDTO) {
    const flashSale = await this.prisma.flashSale.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: false,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            flashPrice: item.flashPrice,
            flashStock: item.flashStock,
            soldCount: 0,
            perUserLimit: item.perUserLimit,
          })),
        },
      },
      include: { items: true },
    });

    // Schedule start and end jobs
    const now = new Date();
    const startDelay = data.startTime.getTime() - now.getTime();
    const endDelay = data.endTime.getTime() - now.getTime();

    if (startDelay > 0) {
      await this.startQueue.add(
        `start-${flashSale.id}`,
        { flashSaleId: flashSale.id },
        { delay: startDelay },
      );
    } else if (startDelay <= 0 && endDelay > 0) {
      // Already started, activate immediately
      await this.activateFlashSale(flashSale.id);
    }

    if (endDelay > 0) {
      await this.endQueue.add(
        `end-${flashSale.id}`,
        { flashSaleId: flashSale.id },
        { delay: endDelay },
      );
    }

    this.logger.log(`Flash sale created: ${flashSale.name} (${flashSale.id})`);
    return flashSale;
  }

  async activateFlashSale(flashSaleId: string) {
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
      include: { items: true },
    });

    if (!flashSale) {
      throw new NotFoundException('Flash sale not found');
    }

    // Initialize Redis stock for each item
    const pipeline = this.redisService.pipeline();
    for (const item of flashSale.items) {
      const stockKey = `${this.FLASH_SALE_STOCK_PREFIX}${item.id}`;
      pipeline.set(stockKey, item.flashStock);
    }
    await pipeline.exec();

    // Activate in database
    await this.prisma.flashSale.update({
      where: { id: flashSaleId },
      data: { isActive: true },
    });

    // Publish event
    this.eventEmitter.emit('FLASH_SALE_STARTED', {
      flashSaleId: flashSale.id,
      name: flashSale.name,
      startTime: flashSale.startTime,
      endTime: flashSale.endTime,
    });

    this.logger.log(`Flash sale activated: ${flashSale.name}`);
  }

  async deactivateFlashSale(flashSaleId: string) {
    const flashSale = await this.prisma.flashSale.update({
      where: { id: flashSaleId },
      data: { isActive: false },
    });

    // Clean up Redis keys
    const items = await this.prisma.flashSaleItem.findMany({
      where: { flashSaleId },
    });

    const pipeline = this.redisService.pipeline();
    for (const item of items) {
      pipeline.del(`${this.FLASH_SALE_STOCK_PREFIX}${item.id}`);
    }
    await pipeline.exec();

    // Publish event
    this.eventEmitter.emit('FLASH_SALE_ENDED', {
      flashSaleId: flashSale.id,
      name: flashSale.name,
      endTime: flashSale.endTime,
    });

    this.logger.log(`Flash sale deactivated: ${flashSale.name}`);
  }

  async getActiveFlashSales() {
    const now = new Date();
    
    const flashSales = await this.prisma.flashSale.findMany({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                sellerId: true,
              },
            },
            variant: true,
          },
        },
      },
    });

    // Add real-time stock from Redis
    const enrichedFlashSales = await Promise.all(
      flashSales.map(async (fs) => {
        const enrichedItems = await Promise.all(
          fs.items.map(async (item) => {
            const stockKey = `${this.FLASH_SALE_STOCK_PREFIX}${item.id}`;
            const remainingStock = await this.redisService.get(stockKey);
            
            return {
              ...item,
              remainingStock: remainingStock ? parseInt(remainingStock) : item.flashStock,
              originalPrice: item.product.price,
            };
          }),
        );
        
        return { ...fs, items: enrichedItems };
      }),
    );

    return enrichedFlashSales;
  }

  async buyFlashSale(data: BuyFlashSaleDTO): Promise<{ success: boolean; orderId?: string }> {
    const { flashSaleId, itemId, userId, quantity } = data;

    // Validate flash sale is active
    const flashSale = await this.prisma.flashSale.findFirst({
      where: {
        id: flashSaleId,
        isActive: true,
        startTime: { lte: new Date() },
        endTime: { gte: new Date() },
      },
    });

    if (!flashSale) {
      throw new BadRequestException('Flash sale is not active');
    }

    // Get flash sale item
    const item = await this.prisma.flashSaleItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('Flash sale item not found');
    }

    // Check user limit using Redis
    const userKey = `${this.FLASH_SALE_USER_PREFIX}${itemId}:${userId}`;
    const userPurchased = await this.redisService.get(userKey);
    const purchasedCount = userPurchased ? parseInt(userPurchased) : 0;

    if (purchasedCount + quantity > item.perUserLimit) {
      throw new BadRequestException(`Maximum ${item.perUserLimit} per user`);
    }

    // ATOMIC: Decrement stock in Redis (critical section)
    const stockKey = `${this.FLASH_SALE_STOCK_PREFIX}${itemId}`;
    const remainingStock = await this.redisService.decrBy(stockKey, quantity);

    if (remainingStock < 0) {
      // Rollback if insufficient stock
      await this.redisService.incrBy(stockKey, quantity);
      throw new BadRequestException('Flash sale item sold out');
    }

    try {
      // Create order in database
      const order = await this.prisma.$transaction(async (tx) => {
        // Update sold count in database
        await tx.flashSaleItem.update({
          where: { id: itemId },
          data: { soldCount: { increment: quantity } },
        });

        // Create master order
        const masterOrder = await tx.masterOrder.create({
          data: {
            buyerId: userId,
            addressId: '', // Will be filled during checkout
            totalAmount: item.flashPrice * quantity,
            shippingFee: 0,
            platformFee: 0,
            grandTotal: item.flashPrice * quantity,
            discountAmount: 0,
            status: 'PENDING_PAYMENT',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        // Create sub order
        const subOrder = await tx.subOrder.create({
          data: {
            masterOrderId: masterOrder.id,
            sellerId: item.product.sellerId,
            destinationAddressId: '',
            totalAmount: item.flashPrice * quantity,
            grandTotal: item.flashPrice * quantity,
            status: 'PENDING_PAYMENT',
          },
        });

        // Create order item
        await tx.orderItem.create({
          data: {
            subOrderId: subOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity,
            price: item.flashPrice,
            totalPrice: item.flashPrice * quantity,
          },
        });

        return masterOrder;
      });

      // Update user purchase count in Redis
      await this.redisService.incrBy(userKey, quantity);
      await this.redisService.expire(userKey, 24 * 60 * 60); // 24 hours TTL

      // Publish event
      this.eventEmitter.emit('FLASH_SALE_ITEM_SOLD', {
        flashSaleId,
        itemId,
        productId: item.productId,
        quantity,
        remainingStock: remainingStock,
      });

      this.logger.log(`Flash sale purchase successful: user ${userId}, item ${itemId}, quantity ${quantity}`);

      return { success: true, orderId: order.id };
    } catch (error) {
      // Rollback Redis stock if database transaction fails
      await this.redisService.incrBy(stockKey, quantity);
      this.logger.error(`Flash sale purchase failed: ${error.message}`);
      throw new BadRequestException('Failed to process flash sale purchase');
    }
  }

  async getRemainingStock(itemId: string): Promise<number> {
    const stockKey = `${this.FLASH_SALE_STOCK_PREFIX}${itemId}`;
    const stock = await this.redisService.get(stockKey);
    return stock ? parseInt(stock) : 0;
  }

  async getFlashSaleDetail(flashSaleId: string) {
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                seller: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!flashSale) {
      throw new NotFoundException('Flash sale not found');
    }

    // Add remaining stock from Redis
    const itemsWithStock = await Promise.all(
      flashSale.items.map(async (item) => {
        const remainingStock = await this.getRemainingStock(item.id);
        return {
          ...item,
          remainingStock,
          soldPercentage: ((item.soldCount / (item.soldCount + remainingStock)) * 100),
        };
      }),
    );

    return { ...flashSale, items: itemsWithStock };
  }
}
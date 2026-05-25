import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { ProductVariant } from '@prisma/client';
import { EventProducer } from '../../queue/producers/event.producer';
import { ProductEvents } from '@daka/shared-events';

@Injectable()
export class ProductVariantService {
  constructor(
    private prisma: PrismaService,
    private eventProducer: EventProducer
  ) {}

  async create(
    sellerId: string,
    productId: string,
    data: CreateVariantDto
  ): Promise<ProductVariant> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    // Check if variant name already exists for this product
    const existingVariant = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        name: data.name,
      },
    });
    if (existingVariant) {
      throw new ConflictException(
        `Variant with name "${data.name}" already exists for this product`
      );
    }

    // Check SKU uniqueness if provided
    if (data.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: data.sku },
      });
      if (existingSku) {
        throw new ConflictException(`Variant with SKU "${data.sku}" already exists`);
      }
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: data.name,
        priceAdjust: data.priceAdjust,
        stock: data.stock,
        sku: data.sku,
        image: data.image,
      },
    });

    // Update product stock to reflect total stock from all variants
    await this.updateProductTotalStock(productId);

    // Publish stock changed event
    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
      aggregateId: productId,
      payload: {
        productId,
        oldStock: product.stock,
        newStock: await this.calculateTotalStock(productId),
        changedAt: new Date().toISOString(),
      },
    });

    return variant;
  }

  async update(
    sellerId: string,
    productId: string,
    variantId: string,
    data: UpdateVariantDto
  ): Promise<ProductVariant> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant with id ${variantId} not found`);
    }

    // Check SKU uniqueness if changing
    if (data.sku && data.sku !== variant.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: data.sku },
      });
      if (existingSku) {
        throw new ConflictException(`Variant with SKU "${data.sku}" already exists`);
      }
    }

    const updatedVariant = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: data.name,
        priceAdjust: data.priceAdjust,
        stock: data.stock,
        sku: data.sku,
        image: data.image,
      },
    });

    // Update product total stock
    await this.updateProductTotalStock(productId);

    // Publish stock changed event if stock changed
    if (data.stock !== undefined && data.stock !== variant.stock) {
      await this.eventProducer.publish({
        eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
        aggregateId: productId,
        payload: {
          productId,
          oldStock: product.stock,
          newStock: await this.calculateTotalStock(productId),
          changedAt: new Date().toISOString(),
        },
      });
    }

    return updatedVariant;
  }

  async delete(sellerId: string, productId: string, variantId: string): Promise<void> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant with id ${variantId} not found`);
    }

    await this.prisma.productVariant.delete({
      where: { id: variantId },
    });

    // Update product total stock
    await this.updateProductTotalStock(productId);

    // Publish stock changed event
    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
      aggregateId: productId,
      payload: {
        productId,
        oldStock: product.stock,
        newStock: await this.calculateTotalStock(productId),
        changedAt: new Date().toISOString(),
      },
    });
  }

  async findByProduct(productId: string): Promise<ProductVariant[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(sellerId: string, productId: string, variantId: string): Promise<ProductVariant> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant with id ${variantId} not found`);
    }

    return variant;
  }

  async updateStock(
    sellerId: string,
    productId: string,
    variantId: string,
    newStock: number
  ): Promise<ProductVariant> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant with id ${variantId} not found`);
    }

    const oldStock = variant.stock;

    const updatedVariant = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock },
    });

    // Update product total stock
    await this.updateProductTotalStock(productId);

    // Publish stock changed event
    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
      aggregateId: productId,
      payload: {
        productId,
        oldStock: product.stock,
        newStock: await this.calculateTotalStock(productId),
        changedAt: new Date().toISOString(),
      },
    });

    return updatedVariant;
  }

  private async calculateTotalStock(productId: string): Promise<number> {
    const result = await this.prisma.productVariant.aggregate({
      where: { productId },
      _sum: { stock: true },
    });
    return result._sum.stock || 0;
  }

  private async updateProductTotalStock(productId: string): Promise<void> {
    const totalStock = await this.calculateTotalStock(productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: totalStock },
    });
  }

  async bulkCreate(
    sellerId: string,
    productId: string,
    variants: CreateVariantDto[]
  ): Promise<ProductVariant[]> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const createdVariants: ProductVariant[] = [];

    for (const variantData of variants) {
      const variant = await this.create(sellerId, productId, variantData);
      createdVariants.push(variant);
    }

    return createdVariants;
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeilisearchClient } from '../../../../infrastructure/meilisearch/meilisearch.client';
import { ProductEvents } from '@daka/shared-events';

@Processor('search-sync')
export class SearchSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchSyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private meilisearch: MeilisearchClient
  ) {
    super();
  }

  async process(job: Job<{ eventName: string; payload: any }>): Promise<void> {
    const { eventName, payload } = job.data;

    this.logger.debug(`Processing search sync for event: ${eventName}`);

    switch (eventName) {
      case ProductEvents.PRODUCT_CREATED:
        await this.handleProductCreated(payload.productId);
        break;

      case ProductEvents.PRODUCT_UPDATED:
        await this.handleProductUpdated(payload.productId);
        break;

      case ProductEvents.PRODUCT_DELETED:
        await this.handleProductDeleted(payload.productId);
        break;

      case ProductEvents.PRODUCT_PRICE_CHANGED:
        await this.handleProductPriceChanged(payload.productId, payload.newPrice);
        break;

      case ProductEvents.PRODUCT_STOCK_CHANGED:
        await this.handleProductStockChanged(payload.productId, payload.newStock);
        break;

      default:
        this.logger.warn(`Unknown event: ${eventName}`);
    }
  }

  private async handleProductCreated(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        seller: {
          select: { full_name: true },
        },
        category: {
          select: { name: true, slug: true },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (product) {
      await this.meilisearch.indexProduct({
        ...product,
        sellerName: product.seller?.full_name,
        categoryName: product.category?.name,
        categorySlug: product.category?.slug,
        images: product.images,
      });
      this.logger.log(`Product ${productId} synced to search (created)`);
    }
  }

  private async handleProductUpdated(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        seller: {
          select: { full_name: true },
        },
        category: {
          select: { name: true, slug: true },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (product) {
      await this.meilisearch.indexProduct({
        ...product,
        sellerName: product.seller?.full_name,
        categoryName: product.category?.name,
        categorySlug: product.category?.slug,
        images: product.images,
      });
      this.logger.log(`Product ${productId} synced to search (updated)`);
    } else {
      // Product was soft deleted
      await this.meilisearch.deleteProduct(productId);
      this.logger.log(`Product ${productId} removed from search (soft deleted)`);
    }
  }

  private async handleProductDeleted(productId: string): Promise<void> {
    await this.meilisearch.deleteProduct(productId);
    this.logger.log(`Product ${productId} removed from search (deleted)`);
  }

  private async handleProductPriceChanged(productId: string, newPrice: number): Promise<void> {
    await this.meilisearch.updateProduct(productId, { price: newPrice });
    this.logger.log(`Product ${productId} price updated in search`);
  }

  private async handleProductStockChanged(productId: string, newStock: number): Promise<void> {
    await this.meilisearch.updateProduct(productId, { stock: newStock });
    this.logger.log(`Product ${productId} stock updated in search`);
  }
}

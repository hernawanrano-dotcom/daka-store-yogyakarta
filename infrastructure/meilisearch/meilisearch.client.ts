import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';

@Injectable()
export class MeilisearchClient implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchClient.name);
  private client: MeiliSearch;
  private productIndex: Index;
  private storeIndex: Index;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get('MEILISEARCH_HOST');
    const masterKey = this.configService.get('MEILISEARCH_MASTER_KEY');

    this.client = new MeiliSearch({
      host,
      apiKey: masterKey,
    });

    await this.initializeIndexes();
    this.logger.log('Meilisearch client initialized');
  }

  private async initializeIndexes() {
    const productIndexName = this.configService.get('MEILISEARCH_INDEX_PRODUCT') || 'products';
    const storeIndexName = this.configService.get('MEILISEARCH_INDEX_STORE') || 'stores';

    // Get or create product index
    this.productIndex = this.client.index(productIndexName);
    await this.setupProductIndexSettings();

    // Get or create store index
    this.storeIndex = this.client.index(storeIndexName);
    await this.setupStoreIndexSettings();

    this.logger.log(`Indexes ready: ${productIndexName}, ${storeIndexName}`);
  }

  private async setupProductIndexSettings() {
    try {
      // Set searchable attributes
      await this.productIndex.updateSettings({
        searchableAttributes: ['name', 'description', 'categoryName', 'sellerName'],
        filterableAttributes: ['categoryId', 'categorySlug', 'sellerId', 'isActive', 'price', 'ratingAvg'],
        sortableAttributes: ['price', 'createdAt', 'soldCount', 'ratingAvg'],
        displayedAttributes: [
          'id',
          'name',
          'slug',
          'description',
          'price',
          'stock',
          'weightGram',
          'images',
          'sellerId',
          'sellerName',
          'categoryId',
          'categoryName',
          'categorySlug',
          'ratingAvg',
          'ratingCount',
          'soldCount',
          'isActive',
          'createdAt',
        ],
      });
      this.logger.log('Product index settings configured');
    } catch (error) {
      this.logger.error(`Failed to setup product index settings: ${error.message}`);
    }
  }

  private async setupStoreIndexSettings() {
    try {
      await this.storeIndex.updateSettings({
        searchableAttributes: ['name', 'description'],
        filterableAttributes: ['sellerId', 'isActive'],
        sortableAttributes: ['createdAt', 'totalSales'],
        displayedAttributes: ['id', 'name', 'description', 'logo', 'sellerId', 'isActive', 'totalSales', 'createdAt'],
      });
      this.logger.log('Store index settings configured');
    } catch (error) {
      this.logger.error(`Failed to setup store index settings: ${error.message}`);
    }
  }

  // ==================== Product Search ====================

  async indexProduct(product: any): Promise<void> {
    try {
      const document = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || '',
        price: product.price,
        stock: product.stock,
        weightGram: product.weightGram,
        images: product.images?.map((img: any) => img.imageUrl) || [],
        sellerId: product.sellerId,
        sellerName: product.seller?.full_name || '',
        categoryId: product.categoryId,
        categoryName: product.category?.name || '',
        categorySlug: product.category?.slug || '',
        ratingAvg: product.ratingAvg || 0,
        ratingCount: product.ratingCount || 0,
        soldCount: product.soldCount || 0,
        isActive: product.isActive,
        createdAt: product.createdAt,
      };

      await this.productIndex.addDocuments([document]);
      this.logger.debug(`Product indexed: ${product.id}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}: ${error.message}`);
    }
  }

  async updateProduct(productId: string, updates: Partial<any>): Promise<void> {
    try {
      const document = {
        id: productId,
        ...updates,
      };
      await this.productIndex.updateDocuments([document]);
      this.logger.debug(`Product updated in index: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to update product ${productId} in index: ${error.message}`);
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.productIndex.deleteDocument(productId);
      this.logger.debug(`Product deleted from index: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to delete product ${productId} from index: ${error.message}`);
    }
  }

  async searchProducts(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      filter?: string;
      sort?: string[];
    },
  ): Promise<any> {
    try {
      const searchParams: any = {
        limit: options?.limit || 20,
        offset: options?.offset || 0,
      };

      if (options?.filter) {
        searchParams.filter = options.filter;
      }

      if (options?.sort) {
        searchParams.sort = options.sort;
      }

      const results = await this.productIndex.search(query, searchParams);
      return results;
    } catch (error) {
      this.logger.error(`Failed to search products: ${error.message}`);
      throw error;
    }
  }

  // ==================== Store Search ====================

  async indexStore(store: any): Promise<void> {
    try {
      const document = {
        id: store.id,
        name: store.name,
        description: store.description || '',
        logo: store.logo,
        sellerId: store.sellerId,
        isActive: store.isActive,
        totalSales: store.totalSales || 0,
        createdAt: store.createdAt,
      };

      await this.storeIndex.addDocuments([document]);
      this.logger.debug(`Store indexed: ${store.id}`);
    } catch (error) {
      this.logger.error(`Failed to index store ${store.id}: ${error.message}`);
    }
  }

  async searchStores(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      filter?: string;
    },
  ): Promise<any> {
    try {
      const searchParams: any = {
        limit: options?.limit || 20,
        offset: options?.offset || 0,
      };

      if (options?.filter) {
        searchParams.filter = options.filter;
      }

      const results = await this.storeIndex.search(query, searchParams);
      return results;
    } catch (error) {
      this.logger.error(`Failed to search stores: ${error.message}`);
      throw error;
    }
  }

  // ==================== Bulk Operations ====================

  async bulkIndexProducts(products: any[]): Promise<void> {
    if (products.length === 0) return;

    try {
      const documents = products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || '',
        price: product.price,
        stock: product.stock,
        weightGram: product.weightGram,
        images: product.images?.map((img: any) => img.imageUrl) || [],
        sellerId: product.sellerId,
        sellerName: product.seller?.full_name || '',
        categoryId: product.categoryId,
        categoryName: product.category?.name || '',
        categorySlug: product.category?.slug || '',
        ratingAvg: product.ratingAvg || 0,
        ratingCount: product.ratingCount || 0,
        soldCount: product.soldCount || 0,
        isActive: product.isActive,
        createdAt: product.createdAt,
      }));

      await this.productIndex.addDocuments(documents);
      this.logger.log(`Bulk indexed ${products.length} products`);
    } catch (error) {
      this.logger.error(`Failed to bulk index products: ${error.message}`);
    }
  }

  async clearProductIndex(): Promise<void> {
    try {
      await this.productIndex.deleteAllDocuments();
      this.logger.log('Product index cleared');
    } catch (error) {
      this.logger.error(`Failed to clear product index: ${error.message}`);
    }
  }
}
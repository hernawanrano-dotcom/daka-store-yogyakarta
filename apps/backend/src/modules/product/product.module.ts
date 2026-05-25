import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductImageController } from './product-image.controller';
import { ProductImageService } from './product-image.service';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';
import { ProductSearchController } from './product-search.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { CloudinaryModule } from '../../../../infrastructure/cloudinary/cloudinary.module';
import { MeilisearchModule } from '../../../../infrastructure/meilisearch/meilisearch.module';

@Module({
  imports: [PrismaModule, QueueModule, CloudinaryModule, MeilisearchModule],
  controllers: [
    ProductController,
    ProductImageController,
    ProductVariantController,
    ProductSearchController,
  ],
  providers: [ProductService, ProductImageService, ProductVariantService],
  exports: [ProductService, ProductImageService, ProductVariantService],
})
export class ProductModule {}

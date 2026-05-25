import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';
import { UploadImageDto, ReorderImageDto, SetPrimaryImageDto } from './dto/upload-image.dto';
import { ProductImage } from '@prisma/client';

@Injectable()
export class ProductImageService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async uploadImages(
    sellerId: string,
    productId: string,
    files: UploadImageDto[],
  ): Promise<ProductImage[]> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const uploadedImages: ProductImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Upload to Cloudinary
      const uploadResult = await this.cloudinary.uploadImage(file.image, {
        folder: `daka-store/products/${productId}`,
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto' },
        ],
      });

      // Check if this is the first image (should be primary)
      const existingImages = await this.prisma.productImage.count({
        where: { productId },
      });
      const isPrimary = file.isPrimary ?? (existingImages === 0 && i === 0);

      // Save to database
      const image = await this.prisma.productImage.create({
        data: {
          productId,
          imageUrl: uploadResult.secure_url,
          isPrimary,
          sortOrder: existingImages + i,
        },
      });

      uploadedImages.push(image);
    }

    return uploadedImages;
  }

  async uploadSingleImage(
    sellerId: string,
    productId: string,
    file: UploadImageDto,
  ): Promise<ProductImage> {
    const images = await this.uploadImages(sellerId, productId, [file]);
    return images[0];
  }

  async deleteImage(sellerId: string, productId: string, imageId: string): Promise<void> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
      include: { images: true },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const image = product.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException(`Image with id ${imageId} not found`);
    }

    // Extract public_id from Cloudinary URL
    const publicId = this.cloudinary.extractPublicId(image.imageUrl);
    if (publicId) {
      await this.cloudinary.deleteImage(publicId);
    }

    // Delete from database
    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    // If deleted image was primary, set another image as primary
    if (image.isPrimary) {
      const remainingImages = await this.prisma.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });

      if (remainingImages.length > 0) {
        await this.prisma.productImage.update({
          where: { id: remainingImages[0].id },
          data: { isPrimary: true },
        });
      }
    }

    // Reorder remaining images
    const remainingImages = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });

    for (let i = 0; i < remainingImages.length; i++) {
      await this.prisma.productImage.update({
        where: { id: remainingImages[i].id },
        data: { sortOrder: i },
      });
    }
  }

  async setPrimaryImage(
    sellerId: string,
    productId: string,
    dto: SetPrimaryImageDto,
  ): Promise<ProductImage> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    const image = await this.prisma.productImage.findFirst({
      where: { id: dto.imageId, productId },
    });
    if (!image) {
      throw new NotFoundException(`Image with id ${dto.imageId} not found`);
    }

    // Remove primary flag from all images
    await this.prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set new primary image
    const updated = await this.prisma.productImage.update({
      where: { id: dto.imageId },
      data: { isPrimary: true },
    });

    return updated;
  }

  async reorderImages(
    sellerId: string,
    productId: string,
    reorders: ReorderImageDto[],
  ): Promise<ProductImage[]> {
    // Verify product ownership
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId, deletedAt: null },
    });
    if (!product) {
      throw new ForbiddenException('You do not own this product');
    }

    // Verify all images belong to product
    for (const reorder of reorders) {
      const image = await this.prisma.productImage.findFirst({
        where: { id: reorder.imageId, productId },
      });
      if (!image) {
        throw new NotFoundException(`Image with id ${reorder.imageId} not found`);
      }
    }

    // Update sort orders
    const updates = reorders.map((reorder) =>
      this.prisma.productImage.update({
        where: { id: reorder.imageId },
        data: { sortOrder: reorder.sortOrder },
      }),
    );

    await this.prisma.$transaction(updates);

    // Return all images in new order
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
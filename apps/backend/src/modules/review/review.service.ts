import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';
import { CreateReviewDto, UpdateReviewDto, ReplyReviewDto, ReviewQueryDto } from './dto/review.dto';
import { Review, ReviewImage } from '@prisma/client';
import { EventProducer } from '../../queue/producers/event.producer';
import { ProductEvents } from '@daka/shared-types';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private eventProducer: EventProducer,
  ) {}

  async create(userId: string, data: CreateReviewDto): Promise<Review> {
    // Check if order exists and belongs to user
    const subOrder = await this.prisma.subOrder.findFirst({
      where: {
        id: data.orderId,
        buyerId: userId,
        status: 'COMPLETED',
      },
    });

    if (!subOrder) {
      throw new BadRequestException(
        'You can only review products from completed orders',
      );
    }

    // Check if order item exists for this product
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        subOrderId: data.orderId,
        productId: data.productId,
      },
    });

    if (!orderItem) {
      throw new BadRequestException('Product not found in this order');
    }

    // Check if already reviewed
    const existingReview = await this.prisma.review.findFirst({
      where: {
        userId,
        productId: data.productId,
        subOrderId: data.orderId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    // Upload images to Cloudinary
    let uploadedImages: { imageUrl: string }[] = [];
    if (data.images && data.images.length > 0) {
      const uploadPromises = data.images.map((image) =>
        this.cloudinary.uploadImage(image, {
          folder: `daka-store/reviews/${data.productId}`,
          transformation: [{ width: 600, height: 600, crop: 'limit', quality: 'auto' }],
        }),
      );
      const uploadResults = await Promise.all(uploadPromises);
      uploadedImages = uploadResults.map((result) => ({
        imageUrl: result.secure_url,
      }));
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: data.productId,
        subOrderId: data.orderId,
        rating: data.rating,
        comment: data.comment,
        isVerifiedPurchase: true,
        images: {
          create: uploadedImages,
        },
      },
      include: {
        images: true,
        user: {
          select: {
            id: true,
            full_name: true,
            avatar: true,
          },
        },
      },
    });

    // Update product rating average
    await this.updateProductRating(data.productId);

    // Publish event
    await this.eventProducer.publish({
      eventName: ProductEvents.REVIEW_CREATED,
      aggregateId: review.id,
      payload: {
        reviewId: review.id,
        productId: data.productId,
        userId,
        rating: data.rating,
        comment: data.comment,
        createdAt: new Date().toISOString(),
      },
    });

    return review;
  }

  async update(
    userId: string,
    reviewId: string,
    data: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not own it');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        images: true,
      },
    });

    // Update product rating if rating changed
    if (data.rating !== undefined && data.rating !== review.rating) {
      await this.updateProductRating(review.productId);
    }

    return updated;
  }

  async delete(userId: string, reviewId: string): Promise<void> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId },
      include: { images: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not own it');
    }

    // Delete images from Cloudinary
    for (const image of review.images) {
      const publicId = this.cloudinary.extractPublicId(image.imageUrl);
      if (publicId) {
        await this.cloudinary.deleteImage(publicId);
      }
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    // Update product rating
    await this.updateProductRating(review.productId);
  }

  async replyToReview(
    sellerId: string,
    reviewId: string,
    data: ReplyReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId },
      include: {
        product: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if seller owns the product
    if (review.product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only reply to reviews for your own products');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        sellerReply: data.reply,
        sellerReplyAt: new Date(),
      },
    });

    return updated;
  }

  async getProductReviews(
    productId: string,
    query: ReviewQueryDto,
  ): Promise<{
    data: any[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      ratingDistribution: Record<number, number>;
      averageRating: number;
    };
  }> {
    const { page, limit, rating, withImages, sort } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    let where: any = { productId };
    if (rating) {
      where.rating = rating;
    }
    if (withImages) {
      where.images = { some: {} };
    }

    // Build order by
    let orderBy: any = {};
    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest':
        orderBy = { rating: 'desc' };
        break;
      case 'lowest':
        orderBy = { rating: 'asc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar: true,
            },
          },
          images: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    // Get rating distribution
    const ratingDistribution = await this.getRatingDistribution(productId);

    // Get average rating
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { ratingAvg: true },
    });

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        ratingDistribution,
        averageRating: product?.ratingAvg || 0,
      },
    };
  }

  async getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: any[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
          images: true,
        },
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      data: reviews,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviewStats(productId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingCounts: { rating: number; count: number }[];
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { ratingAvg: true, ratingCount: true },
    });

    const ratingCounts = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { rating: true },
    });

    return {
      averageRating: product?.ratingAvg || 0,
      totalReviews: product?.ratingCount || 0,
      ratingCounts: ratingCounts.map((r) => ({
        rating: r.rating,
        count: r._count.rating,
      })),
    };
  }

  private async updateProductRating(productId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = result._avg.rating || 0;
    const ratingCount = result._count.rating || 0;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: averageRating,
        ratingCount,
      },
    });
  }

  private async getRatingDistribution(productId: string): Promise<Record<number, number>> {
    const result = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { rating: true },
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of result) {
      distribution[r.rating] = r._count.rating;
    }
    return distribution;
  }

  async addReviewImages(
    userId: string,
    reviewId: string,
    images: string[],
  ): Promise<ReviewImage[]> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not own it');
    }

    const uploadPromises = images.map((image) =>
      this.cloudinary.uploadImage(image, {
        folder: `daka-store/reviews/${review.productId}`,
        transformation: [{ width: 600, height: 600, crop: 'limit', quality: 'auto' }],
      }),
    );

    const uploadResults = await Promise.all(uploadPromises);

    const createdImages = await Promise.all(
      uploadResults.map((result) =>
        this.prisma.reviewImage.create({
          data: {
            reviewId,
            imageUrl: result.secure_url,
          },
        }),
      ),
    );

    return createdImages;
  }

  async deleteReviewImage(
    userId: string,
    reviewId: string,
    imageId: string,
  ): Promise<void> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId },
      include: { images: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found or you do not own it');
    }

    const image = review.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    const publicId = this.cloudinary.extractPublicId(image.imageUrl);
    if (publicId) {
      await this.cloudinary.deleteImage(publicId);
    }

    await this.prisma.reviewImage.delete({
      where: { id: imageId },
    });
  }
}
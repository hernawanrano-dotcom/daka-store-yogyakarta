import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Wishlist, Product } from '@prisma/client';

export interface WishlistWithProduct extends Wishlist {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    isActive: boolean;
    images: { imageUrl: string; isPrimary: boolean }[];
    seller: { id: string; full_name: string };
    ratingAvg: number;
    soldCount: number;
  };
}

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    // Check if product exists and is active (not deleted)
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found or inactive`);
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    // Add to wishlist
    return this.prisma.wishlist.create({
      data: {
        userId,
        productId,
      },
    });
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const wishlistItem = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Product not found in wishlist');
    }

    await this.prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
  }

  async getUserWishlist(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: WishlistWithProduct[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [wishlistItems, total] = await Promise.all([
      this.prisma.wishlist.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { imageUrl: true, isPrimary: true },
              },
              seller: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.wishlist.count({ where: { userId } }),
    ]);

    const formattedData: WishlistWithProduct[] = wishlistItems.map((item) => ({
      ...item,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        stock: item.product.stock,
        isActive: item.product.isActive,
        images: item.product.images,
        seller: item.product.seller,
        ratingAvg: item.product.ratingAvg,
        soldCount: item.product.soldCount,
      },
    }));

    return {
      data: formattedData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const wishlistItem = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    return !!wishlistItem;
  }

  async getWishlistCount(productId: string): Promise<number> {
    return this.prisma.wishlist.count({
      where: { productId },
    });
  }

  async clearWishlist(userId: string): Promise<void> {
    await this.prisma.wishlist.deleteMany({
      where: { userId },
    });
  }
}

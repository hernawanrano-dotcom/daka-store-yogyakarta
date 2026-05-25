import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, CreateVariantDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Product, ProductVariant, Prisma } from '@prisma/client';
import { EventProducer } from '../../queue/producers/event.producer';
import { ProductEvents } from '@daka/shared-events';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private eventProducer: EventProducer,
  ) {}

  async create(sellerId: string, data: CreateProductDto): Promise<Product> {
    // Cek slug unik
    const existing = await this.prisma.product.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new ConflictException(`Product with slug ${data.slug} already exists`);
    }

    // Cek category exists
    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: data.categoryId, deletedAt: null },
      });
      if (!category) {
        throw new NotFoundException(`Category with id ${data.categoryId} not found`);
      }
    }

    // Create product with variants in transaction
    const product = await this.prisma.$transaction(async (tx) => {
      // Create product
      const newProduct = await tx.product.create({
        data: {
          sellerId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: data.price,
          stock: data.stock,
          weightGram: data.weightGram,
          categoryId: data.categoryId,
          isActive: data.isActive ?? true,
          isFeatured: data.isFeatured ?? false,
        },
      });

      // Create images
      if (data.images && data.images.length > 0) {
        await tx.productImage.createMany({
          data: data.images.map((url, idx) => ({
            productId: newProduct.id,
            imageUrl: url,
            isPrimary: idx === 0,
            sortOrder: idx,
          })),
        });
      }

      // Create variants
      if (data.variants && data.variants.length > 0) {
        await tx.productVariant.createMany({
          data: data.variants.map((variant: CreateVariantDto) => ({
            productId: newProduct.id,
            name: variant.name,
            priceAdjust: variant.priceAdjust,
            stock: variant.stock,
            image: variant.image,
          })),
        });
      }

      return newProduct;
    });

    // Publish event via outbox
    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_CREATED,
      aggregateId: product.id,
      payload: {
        productId: product.id,
        sellerId: product.sellerId,
        name: product.name,
        price: product.price,
        stock: product.stock,
        createdAt: new Date().toISOString(),
      },
    });

    return product;
  }

  async findAll(query: ProductQueryDto, userId?: string) {
    const { page, limit, search, categoryId, categorySlug, minPrice, maxPrice, minRating, sort } =
      query;
    const skip = (page - 1) * limit;

    // Build where clause
    let where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (minRating !== undefined) {
      where.ratingAvg = { gte: minRating };
    }

    // Build order by
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sort) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'popular':
        orderBy = { soldCount: 'desc' };
        break;
      case 'rating':
        orderBy = { ratingAvg: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          seller: {
            select: {
              id: true,
              full_name: true,
              avatar: true,
            },
          },
          category: true,
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: {
            select: { reviews: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Check if product is in user's wishlist
    let wishlistProductIds: string[] = [];
    if (userId) {
      const wishlist = await this.prisma.wishlist.findMany({
        where: { userId },
        select: { productId: true },
      });
      wishlistProductIds = wishlist.map((w) => w.productId);
    }

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.images[0]?.imageUrl || null,
      sellerName: product.seller?.full_name,
      sellerId: product.seller?.id,
      ratingAvg: product.ratingAvg,
      ratingCount: product._count.reviews,
      soldCount: product.soldCount,
      isInWishlist: wishlistProductIds.includes(product.id),
      createdAt: product.createdAt,
    }));

    return {
      data: formattedProducts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        seller: {
          select: {
            id: true,
            full_name: true,
            avatar: true,
            phone: true,
          },
        },
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
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
        },
        _count: {
          select: { reviews: true, wishlists: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Increment view count
    await this.prisma.product.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    // Check if in wishlist
    let isInWishlist = false;
    if (userId) {
      const wishlistItem = await this.prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId: id,
          },
        },
      });
      isInWishlist = !!wishlistItem;
    }

    return {
      ...product,
      isInWishlist,
      ratingCount: product._count.reviews,
      wishlistCount: product._count.wishlists,
    };
  }

  async findBySlug(slug: string, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: {
        seller: {
          select: {
            id: true,
            full_name: true,
            avatar: true,
            phone: true,
          },
        },
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
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
        },
        _count: {
          select: { reviews: true, wishlists: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    // Increment view count
    await this.prisma.product.update({
      where: { id: product.id },
      data: { viewsCount: { increment: 1 } },
    });

    // Check if in wishlist
    let isInWishlist = false;
    if (userId) {
      const wishlistItem = await this.prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId: product.id,
          },
        },
      });
      isInWishlist = !!wishlistItem;
    }

    return {
      ...product,
      isInWishlist,
      ratingCount: product._count.reviews,
      wishlistCount: product._count.wishlists,
    };
  }

  async update(sellerId: string, id: string, data: UpdateProductDto) {
    const product = await this.findOne(id);

    // Check ownership (seller can only update their own products)
    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only update your own products');
    }

    const oldPrice = product.price;
    const oldStock = product.stock;

    const updatedProduct = await this.prisma.$transaction(async (tx) => {
      // Update product
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: data.price,
          stock: data.stock,
          weightGram: data.weightGram,
          categoryId: data.categoryId,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
        },
      });

      // Handle images if provided
      if (data.images && data.images.length > 0) {
        // Delete old images
        await tx.productImage.deleteMany({ where: { productId: id } });
        // Create new images
        await tx.productImage.createMany({
          data: data.images.map((url, idx) => ({
            productId: id,
            imageUrl: url,
            isPrimary: idx === 0,
            sortOrder: idx,
          })),
        });
      }

      // Handle variants if provided (replace all)
      if (data.variants) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (data.variants.length > 0) {
          await tx.productVariant.createMany({
            data: data.variants.map((variant) => ({
              productId: id,
              name: variant.name,
              priceAdjust: variant.priceAdjust,
              stock: variant.stock,
              image: variant.image,
            })),
          });
        }
      }

      return updated;
    });

    // Publish events if price or stock changed
    if (data.price !== undefined && data.price !== oldPrice) {
      await this.eventProducer.publish({
        eventName: ProductEvents.PRODUCT_PRICE_CHANGED,
        aggregateId: id,
        payload: {
          productId: id,
          oldPrice,
          newPrice: data.price,
          changedAt: new Date().toISOString(),
        },
      });
    }

    if (data.stock !== undefined && data.stock !== oldStock) {
      await this.eventProducer.publish({
        eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
        aggregateId: id,
        payload: {
          productId: id,
          oldStock,
          newStock: data.stock,
          changedAt: new Date().toISOString(),
        },
      });
    }

    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_UPDATED,
      aggregateId: id,
      payload: {
        productId: id,
        sellerId,
        changes: data,
        updatedAt: new Date().toISOString(),
      },
    });

    return updatedProduct;
  }

  async remove(sellerId: string, id: string) {
    const product = await this.findOne(id);

    // Check ownership
    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    // Soft delete
    const deleted = await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_DELETED,
      aggregateId: id,
      payload: {
        productId: id,
        sellerId,
        deletedAt: new Date().toISOString(),
      },
    });

    return deleted;
  }

  async findBySeller(sellerId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { sellerId, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: {
            select: { reviews: true },
          },
        },
      }),
      this.prisma.product.count({ where: { sellerId, deletedAt: null } }),
    ]);

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      image: product.images[0]?.imageUrl || null,
      isActive: product.isActive,
      ratingAvg: product.ratingAvg,
      ratingCount: product._count.reviews,
      soldCount: product.soldCount,
      viewsCount: product.viewsCount,
      createdAt: product.createdAt,
    }));

    return {
      data: formattedProducts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStock(id: string, newStock: number) {
    const product = await this.findOne(id);
    const oldStock = product.stock;

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    await this.eventProducer.publish({
      eventName: ProductEvents.PRODUCT_STOCK_CHANGED,
      aggregateId: id,
      payload: {
        productId: id,
        oldStock,
        newStock,
        changedAt: new Date().toISOString(),
      },
    });

    return updated;
  }
}
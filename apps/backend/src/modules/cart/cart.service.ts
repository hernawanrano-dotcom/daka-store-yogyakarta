import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getCart(userId: string | null, sessionId: string | null) {
    if (userId) {
      return this.getUserCart(userId);
    } else if (sessionId) {
      return this.getGuestCart(sessionId);
    }
    return { items: [], totalPrice: 0 };
  }

  private async getUserCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stock: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                price_adjust: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return { items: [], totalPrice: 0 };
    }

    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product.name,
      variantId: item.variant_id,
      variantName: item.variant?.name,
      quantity: item.quantity,
      price: item.product.price + (item.variant?.price_adjust || 0),
      totalPrice: (item.product.price + (item.variant?.price_adjust || 0)) * item.quantity,
      image: item.product.images?.[0] || '',
      stock: item.product.stock,
    }));

    const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);

    return { items, totalPrice };
  }

  private async getGuestCart(sessionId: string) {
    const cacheKey = `cart:guest:${sessionId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    return { items: [], totalPrice: 0 };
  }

  async addToCart(
    userId: string | null,
    sessionId: string | null,
    productId: string,
    variantId: string | null,
    quantity: number,
  ) {
    if (quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    // Cek stok
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${product.stock}`);
    }

    if (userId) {
      return this.addToUserCart(userId, productId, variantId, quantity);
    } else if (sessionId) {
      return this.addToGuestCart(sessionId, productId, variantId, quantity, product.price);
    }

    throw new BadRequestException('No user or session ID provided');
  }

  private async addToUserCart(userId: string, productId: string, variantId: string | null, quantity: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { user_id: userId },
      });
    }

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        product_id: productId,
        variant_id: variantId,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: productId,
          variant_id: variantId,
          quantity,
        },
      });
    }

    return this.getUserCart(userId);
  }

  private async addToGuestCart(sessionId: string, productId: string, variantId: string | null, quantity: number, price: number) {
    const cacheKey = `cart:guest:${sessionId}`;
    let cart = await this.redis.get(cacheKey);

    if (!cart) {
      cart = { items: [], totalPrice: 0 };
    } else {
      cart = JSON.parse(cart);
    }

    const existingIndex = cart.items.findIndex(
      (item: any) => item.productId === productId && item.variantId === variantId,
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].totalPrice = cart.items[existingIndex].price * cart.items[existingIndex].quantity;
    } else {
      cart.items.push({
        id: `temp_${Date.now()}_${Math.random()}`,
        productId,
        variantId,
        quantity,
        price,
        totalPrice: price * quantity,
      });
    }

    cart.totalPrice = cart.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

    await this.redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(cart));

    return cart;
  }

  async updateCartItem(userId: string | null, sessionId: string | null, itemId: string, quantity: number) {
    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    if (quantity === 0) {
      return this.removeCartItem(userId, sessionId, itemId);
    }

    if (userId) {
      const item = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { product: true },
      });

      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (item.product.stock < quantity) {
        throw new BadRequestException(`Insufficient stock. Available: ${item.product.stock}`);
      }

      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });

      return this.getUserCart(userId);
    } else if (sessionId) {
      const cacheKey = `cart:guest:${sessionId}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const cart = JSON.parse(cached);
        const itemIndex = cart.items.findIndex((item: any) => item.id === itemId);

        if (itemIndex >= 0) {
          cart.items[itemIndex].quantity = quantity;
          cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;
          cart.totalPrice = cart.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

          await this.redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(cart));
          return cart;
        }
      }

      return { items: [], totalPrice: 0 };
    }

    throw new BadRequestException('No user or session ID provided');
  }

  async removeCartItem(userId: string | null, sessionId: string | null, itemId: string) {
    if (userId) {
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });
      return this.getUserCart(userId);
    } else if (sessionId) {
      const cacheKey = `cart:guest:${sessionId}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const cart = JSON.parse(cached);
        cart.items = cart.items.filter((item: any) => item.id !== itemId);
        cart.totalPrice = cart.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

        await this.redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(cart));
        return cart;
      }
    }

    return { items: [], totalPrice: 0 };
  }

  async clearCart(userId: string | null, sessionId: string | null) {
    if (userId) {
      await this.prisma.cartItem.deleteMany({
        where: { cart: { user_id: userId } },
      });
      return { items: [], totalPrice: 0 };
    } else if (sessionId) {
      const cacheKey = `cart:guest:${sessionId}`;
      await this.redis.del(cacheKey);
      return { items: [], totalPrice: 0 };
    }

    return { items: [], totalPrice: 0 };
  }

  async mergeGuestCartToUser(userId: string, sessionId: string) {
    const guestCartKey = `cart:guest:${sessionId}`;
    const guestCart = await this.redis.get(guestCartKey);

    if (!guestCart) {
      return;
    }

    const cart = JSON.parse(guestCart);

    let userCart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (!userCart) {
      userCart = await this.prisma.cart.create({
        data: { user_id: userId },
      });
    }

    for (const item of cart.items) {
      const existing = await this.prisma.cartItem.findFirst({
        where: {
          cart_id: userCart.id,
          product_id: item.productId,
          variant_id: item.variantId,
        },
      });

      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + item.quantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cart_id: userCart.id,
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
          },
        });
      }
    }

    await this.redis.del(guestCartKey);

    return this.getUserCart(userId);
  }
}
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id: string; email: string; role: string };
}

interface AddToCartDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface UpdateCartItemDto {
  quantity: number;
}

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  /**
   * Get cart (auto detect: authenticated user or guest)
   */
  @Get()
  async getCart(@Req() req: RequestWithUser, @Query('sessionId') sessionId?: string) {
    let cart;
    
    if (req.user?.id) {
      cart = await this.cartService.getUserCart(req.user.id);
    } else if (sessionId) {
      cart = await this.cartService.getGuestCart(sessionId);
    } else {
      cart = { items: [], totalPrice: 0, totalItems: 0 };
    }

    return {
      success: true,
      message: 'Cart retrieved successfully',
      data: cart,
    };
  }

  /**
   * Add item to cart
   */
  @Post('items')
  async addToCart(
    @Req() req: RequestWithUser,
    @Query('sessionId') sessionId: string,
    @Body() dto: AddToCartDto,
  ) {
    if (dto.quantity <= 0) {
      return {
        success: false,
        message: 'Quantity must be greater than 0',
        error: { code: 'VAL_001', details: null },
      };
    }

    let cart;
    
    if (req.user?.id) {
      cart = await this.cartService.addToUserCart(
        req.user.id,
        dto.productId,
        dto.quantity,
        dto.variantId,
      );
    } else if (sessionId) {
      cart = await this.cartService.addToGuestCart(
        sessionId,
        dto.productId,
        dto.quantity,
        dto.variantId,
      );
    } else {
      return {
        success: false,
        message: 'Session ID required for guest cart',
        error: { code: 'AUTH_001', details: null },
      };
    }

    return {
      success: true,
      message: 'Item added to cart',
      data: cart,
    };
  }

  /**
   * Update cart item quantity
   */
  @Put('items/:itemId')
  async updateCartItem(
    @Req() req: RequestWithUser,
    @Param('itemId') itemId: string,
    @Query('sessionId') sessionId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    let cart;
    
    if (req.user?.id) {
      cart = await this.cartService.updateUserCartItem(
        req.user.id,
        itemId,
        dto.quantity,
      );
    } else if (sessionId) {
      // Untuk guest cart, itemId adalah kombinasi productId:variantId
      const [productId, variantId] = itemId.split(':');
      cart = await this.cartService.updateGuestCartItem(
        sessionId,
        productId,
        dto.quantity,
        variantId || undefined,
      );
    } else {
      return {
        success: false,
        message: 'Session ID required for guest cart',
        error: { code: 'AUTH_001', details: null },
      };
    }

    return {
      success: true,
      message: 'Cart item updated',
      data: cart,
    };
  }

  /**
   * Remove item from cart
   */
  @Delete('items/:itemId')
  async removeCartItem(
    @Req() req: RequestWithUser,
    @Param('itemId') itemId: string,
    @Query('sessionId') sessionId: string,
  ) {
    let cart;
    
    if (req.user?.id) {
      cart = await this.cartService.removeUserCartItem(req.user.id, itemId);
    } else if (sessionId) {
      const [productId, variantId] = itemId.split(':');
      cart = await this.cartService.removeGuestCartItem(
        sessionId,
        productId,
        variantId || undefined,
      );
    } else {
      return {
        success: false,
        message: 'Session ID required for guest cart',
        error: { code: 'AUTH_001', details: null },
      };
    }

    return {
      success: true,
      message: 'Item removed from cart',
      data: cart,
    };
  }

  /**
   * Clear entire cart
   */
  @Delete()
  async clearCart(@Req() req: RequestWithUser, @Query('sessionId') sessionId: string) {
    let cart;
    
    if (req.user?.id) {
      cart = await this.cartService.clearUserCart(req.user.id);
    } else if (sessionId) {
      cart = await this.cartService.clearGuestCart(sessionId);
    } else {
      cart = { items: [], totalPrice: 0, totalItems: 0 };
    }

    return {
      success: true,
      message: 'Cart cleared',
      data: cart,
    };
  }

  /**
   * Merge guest cart to user cart (after login)
   */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeCart(@Req() req: RequestWithUser, @Body('sessionId') sessionId: string) {
    if (!req.user?.id || !sessionId) {
      return {
        success: false,
        message: 'User ID and session ID required',
        error: { code: 'VAL_001', details: null },
      };
    }

    await this.cartService.mergeGuestCartToUser(sessionId, req.user.id);

    return {
      success: true,
      message: 'Cart merged successfully',
      data: null,
    };
  }
}
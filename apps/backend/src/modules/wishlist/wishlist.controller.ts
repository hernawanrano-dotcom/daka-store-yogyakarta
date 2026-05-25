import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/wishlist.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async getUserWishlist(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.wishlistService.getUserWishlist(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      message: 'Wishlist retrieved successfully',
      ...result,
    };
  }

  @Get('check/:productId')
  async isInWishlist(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    const data = await this.wishlistService.isInWishlist(userId, productId);
    return {
      success: true,
      message: 'Wishlist status retrieved',
      data: { isInWishlist: data },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addToWishlist(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToWishlistDto,
  ) {
    const data = await this.wishlistService.addToWishlist(userId, dto.productId);
    return {
      success: true,
      message: 'Product added to wishlist successfully',
      data,
    };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  async removeFromWishlist(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    await this.wishlistService.removeFromWishlist(userId, productId);
    return {
      success: true,
      message: 'Product removed from wishlist successfully',
      data: null,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearWishlist(@CurrentUser('id') userId: string) {
    await this.wishlistService.clearWishlist(userId);
    return {
      success: true,
      message: 'Wishlist cleared successfully',
      data: null,
    };
  }
}
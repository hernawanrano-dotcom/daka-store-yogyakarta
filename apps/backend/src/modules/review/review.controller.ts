import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReplyReviewDto,
  ReviewQueryDto,
} from './dto/review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@daka/shared-types';

@Controller('api/v1/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ==================== Customer Endpoints ====================

  @Get('product/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    const result = await this.reviewService.getProductReviews(productId, query);
    return {
      success: true,
      message: 'Product reviews retrieved successfully',
      ...result,
    };
  }

  @Get('product/:productId/stats')
  async getReviewStats(@Param('productId') productId: string) {
    const data = await this.reviewService.getReviewStats(productId);
    return {
      success: true,
      message: 'Review statistics retrieved successfully',
      data,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserReviews(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.reviewService.getUserReviews(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      message: 'Your reviews retrieved successfully',
      ...result,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.reviewService.create(userId, dto);
    return {
      success: true,
      message: 'Review created successfully',
      data,
    };
  }

  @Put(':reviewId')
  @UseGuards(JwtAuthGuard)
  async updateReview(
    @CurrentUser('id') userId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    const data = await this.reviewService.update(userId, reviewId, dto);
    return {
      success: true,
      message: 'Review updated successfully',
      data,
    };
  }

  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteReview(
    @CurrentUser('id') userId: string,
    @Param('reviewId') reviewId: string,
  ) {
    await this.reviewService.delete(userId, reviewId);
    return {
      success: true,
      message: 'Review deleted successfully',
      data: null,
    };
  }

  // ==================== Seller Endpoints ====================

  @Post(':reviewId/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async replyToReview(
    @CurrentUser('id') sellerId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    const data = await this.reviewService.replyToReview(sellerId, reviewId, dto);
    return {
      success: true,
      message: 'Reply posted successfully',
      data,
    };
  }

  // ==================== Review Images ====================

  @Post(':reviewId/images')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addReviewImages(
    @CurrentUser('id') userId: string,
    @Param('reviewId') reviewId: string,
    @Body('images') images: string[],
  ) {
    const data = await this.reviewService.addReviewImages(userId, reviewId, images);
    return {
      success: true,
      message: 'Images added successfully',
      data,
    };
  }

  @Delete(':reviewId/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteReviewImage(
    @CurrentUser('id') userId: string,
    @Param('reviewId') reviewId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.reviewService.deleteReviewImage(userId, reviewId, imageId);
    return {
      success: true,
      message: 'Image deleted successfully',
      data: null,
    };
  }
}
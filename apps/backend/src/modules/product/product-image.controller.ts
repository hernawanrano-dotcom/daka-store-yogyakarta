import {
  Controller,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductImageService } from './product-image.service';
import { UploadImageDto, ReorderImageDto, SetPrimaryImageDto } from './dto/upload-image.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@daka/shared-types';

@Controller('api/v1/products/:productId/images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER)
export class ProductImageController {
  constructor(private readonly productImageService: ProductImageService) {}

  @Post()
  async uploadImages(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() files: UploadImageDto[],
  ) {
    const data = await this.productImageService.uploadImages(sellerId, productId, files);
    return {
      success: true,
      message: 'Images uploaded successfully',
      data,
    };
  }

  @Post('single')
  async uploadSingleImage(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() file: UploadImageDto,
  ) {
    const data = await this.productImageService.uploadSingleImage(sellerId, productId, file);
    return {
      success: true,
      message: 'Image uploaded successfully',
      data,
    };
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.OK)
  async deleteImage(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.productImageService.deleteImage(sellerId, productId, imageId);
    return {
      success: true,
      message: 'Image deleted successfully',
      data: null,
    };
  }

  @Put('primary')
  async setPrimaryImage(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() dto: SetPrimaryImageDto,
  ) {
    const data = await this.productImageService.setPrimaryImage(sellerId, productId, dto);
    return {
      success: true,
      message: 'Primary image set successfully',
      data,
    };
  }

  @Put('reorder')
  async reorderImages(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() reorders: ReorderImageDto[],
  ) {
    const data = await this.productImageService.reorderImages(sellerId, productId, reorders);
    return {
      success: true,
      message: 'Images reordered successfully',
      data,
    };
  }
}
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductVariantService } from './product-variant.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@daka/shared-types';

@Controller('api/v1/products/:productId/variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER)
export class ProductVariantController {
  constructor(private readonly variantService: ProductVariantService) {}

  @Get()
  async findByProduct(@Param('productId') productId: string) {
    const data = await this.variantService.findByProduct(productId);
    return {
      success: true,
      message: 'Product variants retrieved successfully',
      data,
    };
  }

  @Get(':variantId')
  async findOne(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string
  ) {
    const data = await this.variantService.findOne(sellerId, productId, variantId);
    return {
      success: true,
      message: 'Variant retrieved successfully',
      data,
    };
  }

  @Post()
  async create(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto
  ) {
    const data = await this.variantService.create(sellerId, productId, dto);
    return {
      success: true,
      message: 'Variant created successfully',
      data,
    };
  }

  @Post('bulk')
  async bulkCreate(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Body() variants: CreateVariantDto[]
  ) {
    const data = await this.variantService.bulkCreate(sellerId, productId, variants);
    return {
      success: true,
      message: 'Variants created successfully',
      data,
    };
  }

  @Put(':variantId')
  async update(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto
  ) {
    const data = await this.variantService.update(sellerId, productId, variantId, dto);
    return {
      success: true,
      message: 'Variant updated successfully',
      data,
    };
  }

  @Put(':variantId/stock')
  async updateStock(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body('stock') stock: number
  ) {
    const data = await this.variantService.updateStock(sellerId, productId, variantId, stock);
    return {
      success: true,
      message: 'Variant stock updated successfully',
      data,
    };
  }

  @Delete(':variantId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser('id') sellerId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string
  ) {
    await this.variantService.delete(sellerId, productId, variantId);
    return {
      success: true,
      message: 'Variant deleted successfully',
      data: null,
    };
  }
}

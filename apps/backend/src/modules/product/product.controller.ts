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
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@daka/shared-types';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Controller('api/v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(@Query() query: ProductQueryDto, @Req() req: RequestWithUser) {
    const userId = req.user?.id;
    const result = await this.productService.findAll(query, userId);
    return {
      success: true,
      message: 'Products retrieved successfully',
      ...result,
    };
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async findSellerProducts(
    @CurrentUser('id') sellerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const result = await this.productService.findBySeller(
      sellerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
    return {
      success: true,
      message: 'Seller products retrieved successfully',
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user?.id;
    const data = await this.productService.findOne(id, userId);
    return {
      success: true,
      message: 'Product retrieved successfully',
      data,
    };
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @Req() req: RequestWithUser) {
    const userId = req.user?.id;
    const data = await this.productService.findBySlug(slug, userId);
    return {
      success: true,
      message: 'Product retrieved successfully',
      data,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async create(@CurrentUser('id') sellerId: string, @Body() dto: CreateProductDto) {
    const data = await this.productService.create(sellerId, dto);
    return {
      success: true,
      message: 'Product created successfully',
      data,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async update(
    @CurrentUser('id') sellerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto
  ) {
    const data = await this.productService.update(sellerId, id, dto);
    return {
      success: true,
      message: 'Product updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser('id') sellerId: string, @Param('id') id: string) {
    await this.productService.remove(sellerId, id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data: null,
    };
  }
}

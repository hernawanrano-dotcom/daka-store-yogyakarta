import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { FlashSaleService, BuyFlashSaleDTO } from './flash-sale.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@daka/shared-types';

interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('flash-sale')
export class FlashSaleController {
  constructor(private flashSaleService: FlashSaleService) {}

  @Get('active')
  async getActiveFlashSales() {
    const flashSales = await this.flashSaleService.getActiveFlashSales();
    return {
      success: true,
      message: 'Active flash sales retrieved successfully',
      data: flashSales,
    };
  }

  @Get(':id')
  async getFlashSaleDetail(@Param('id') id: string) {
    const flashSale = await this.flashSaleService.getFlashSaleDetail(id);
    return {
      success: true,
      message: 'Flash sale detail retrieved successfully',
      data: flashSale,
    };
  }

  @Get('item/:itemId/stock')
  async getRemainingStock(@Param('itemId') itemId: string) {
    const stock = await this.flashSaleService.getRemainingStock(itemId);
    return {
      success: true,
      message: 'Stock retrieved successfully',
      data: { remainingStock: stock },
    };
  }

  @Post('buy')
  @UseGuards(JwtAuthGuard)
  async buyFlashSale(@Req() req: RequestWithUser, @Body() buyDto: BuyFlashSaleDTO) {
    const result = await this.flashSaleService.buyFlashSale({
      ...buyDto,
      userId: req.user.id,
    });

    return {
      success: true,
      message: 'Flash sale purchase successful',
      data: result,
    };
  }
}

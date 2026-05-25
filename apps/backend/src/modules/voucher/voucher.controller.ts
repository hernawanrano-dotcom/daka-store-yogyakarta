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
import { VoucherService, CreateVoucherDto, ApplyVoucherDto } from './voucher.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VoucherType } from '@prisma/client';
import { UserRole } from '@daka/shared-types';

interface RequestWithUser extends Request {
  user?: { id: string; email: string; role: string };
}

@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VoucherController {
  constructor(private voucherService: VoucherService) {}

  /**
   * GET /api/v1/vouchers/available
   * Get all active marketplace vouchers
   */
  @Get('available')
  async getAvailableVouchers() {
    const vouchers = await this.voucherService.getActiveVouchers();

    return {
      success: true,
      message: 'Available vouchers retrieved successfully',
      data: vouchers,
    };
  }

  /**
   * GET /api/v1/vouchers/my
   * Get user's claimed vouchers
   */
  @Get('my')
  async getMyVouchers(@Req() req: RequestWithUser) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const vouchers = await this.voucherService.getUserVouchers(userId);

    return {
      success: true,
      message: 'My vouchers retrieved successfully',
      data: vouchers,
    };
  }

  /**
   * POST /api/v1/vouchers/:id/claim
   * Claim a voucher
   */
  @Post(':id/claim')
  async claimVoucher(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const userVoucher = await this.voucherService.claimVoucher(userId, id);

    return {
      success: true,
      message: 'Voucher claimed successfully',
      data: userVoucher,
    };
  }

  /**
   * POST /api/v1/vouchers/apply
   * Apply voucher to checkout (calculate discount)
   */
  @Post('apply')
  async applyVoucher(@Req() req: RequestWithUser, @Body() dto: ApplyVoucherDto) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const result = await this.voucherService.applyVoucher(userId, dto);

    return {
      success: true,
      message: 'Voucher applied successfully',
      data: result,
    };
  }

  /**
   * GET /api/v1/vouchers/code/:code
   * Get voucher by code
   */
  @Get('code/:code')
  async getVoucherByCode(@Param('code') code: string) {
    const voucher = await this.voucherService.getVoucherByCode(code);

    return {
      success: true,
      message: 'Voucher retrieved successfully',
      data: voucher,
    };
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * POST /api/v1/vouchers/admin/marketplace
   * Create marketplace voucher (admin only)
   */
  @Post('admin/marketplace')
  @Roles(UserRole.admin)
  @UseGuards(RolesGuard)
  async createMarketplaceVoucher(@Body() dto: CreateVoucherDto) {
    const voucher = await this.voucherService.createMarketplaceVoucher(dto);

    return {
      success: true,
      message: 'Marketplace voucher created successfully',
      data: voucher,
    };
  }

  // ==================== SELLER ENDPOINTS ====================

  /**
   * GET /api/v1/vouchers/seller/my
   * Get seller's vouchers
   */
  @Get('seller/my')
  @Roles(UserRole.seller, UserRole.admin)
  @UseGuards(RolesGuard)
  async getSellerVouchers(@Req() req: RequestWithUser) {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const vouchers = await this.voucherService.getSellerVouchers(sellerId);

    return {
      success: true,
      message: 'Seller vouchers retrieved successfully',
      data: vouchers,
    };
  }

  /**
   * POST /api/v1/vouchers/seller
   * Create seller voucher (seller only)
   */
  @Post('seller')
  @Roles(UserRole.seller, UserRole.admin)
  @UseGuards(RolesGuard)
  async createSellerVoucher(@Req() req: RequestWithUser, @Body() dto: CreateVoucherDto) {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    dto.type = VoucherType.SELLER;
    const voucher = await this.voucherService.createSellerVoucher(sellerId, dto);

    return {
      success: true,
      message: 'Seller voucher created successfully',
      data: voucher,
    };
  }

  /**
   * GET /api/v1/vouchers/seller/stats
   * Get seller's voucher statistics
   */
  @Get('seller/stats')
  @Roles(UserRole.seller, UserRole.admin)
  @UseGuards(RolesGuard)
  async getSellerVoucherStats(@Req() req: RequestWithUser) {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    const stats = await this.voucherService.getSellerVoucherStats(sellerId);

    return {
      success: true,
      message: 'Seller voucher statistics retrieved successfully',
      data: stats,
    };
  }

  /**
   * DELETE /api/v1/vouchers/:id
   * Deactivate voucher (admin or seller who owns it)
   */
  @Delete(':id')
  async deactivateVoucher(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user?.id;
    const role = req.user?.role || 'buyer';

    if (!userId) {
      return {
        success: false,
        message: 'User not authenticated',
        error: { code: 'AUTH_001', details: null },
      };
    }

    await this.voucherService.deactivateVoucher(id, userId, role);

    return {
      success: true,
      message: 'Voucher deactivated successfully',
      data: null,
    };
  }
}

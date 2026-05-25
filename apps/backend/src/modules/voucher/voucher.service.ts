import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherType, VoucherDiscountType } from '@prisma/client';

export interface CreateVoucherDto {
  code: string;
  name: string;
  type: VoucherType;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount?: number;
  minSpend: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate: Date;
  endDate: Date;
  sellerId?: string;
}

export interface ApplyVoucherDto {
  voucherCode: string;
  cartTotal: number;
}

export interface ApplyVoucherResponse {
  discountAmount: number;
  newTotal: number;
  voucher: any;
}

@Injectable()
export class VoucherService {
  private readonly logger = new Logger(VoucherService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create marketplace voucher (admin only)
   */
  async createMarketplaceVoucher(dto: CreateVoucherDto): Promise<any> {
    if (dto.type !== VoucherType.MARKETPLACE) {
      throw new BadRequestException('Voucher type must be MARKETPLACE');
    }

    const existing = await this.prisma.voucher.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('Voucher code already exists');
    }

    const voucher = await this.prisma.voucher.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscount: dto.maxDiscount,
        minSpend: dto.minSpend,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit || 1,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: true,
      },
    });

    this.logger.log(`Marketplace voucher created: ${voucher.code}`);
    return voucher;
  }

  /**
   * Create seller voucher (seller only)
   */
  async createSellerVoucher(sellerId: string, dto: CreateVoucherDto): Promise<any> {
    if (dto.type !== VoucherType.SELLER) {
      throw new BadRequestException('Voucher type must be SELLER');
    }

    const existing = await this.prisma.voucher.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException('Voucher code already exists');
    }

    const voucher = await this.prisma.voucher.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscount: dto.maxDiscount,
        minSpend: dto.minSpend,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit || 1,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: true,
        sellerId,
      },
    });

    this.logger.log(`Seller voucher created: ${voucher.code} by seller ${sellerId}`);
    return voucher;
  }

  /**
   * Get all active vouchers (marketplace)
   */
  async getActiveVouchers(): Promise<any[]> {
    const now = new Date();

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        type: VoucherType.MARKETPLACE,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          { usageLimit: null },
          { usedCount: { lt: this.prisma.voucher.fields.usageLimit } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return vouchers;
  }

  /**
   * Get seller vouchers
   */
  async getSellerVouchers(sellerId: string): Promise<any[]> {
    const now = new Date();

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        sellerId,
        type: VoucherType.SELLER,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vouchers;
  }

  /**
   * Get user's claimed vouchers
   */
  async getUserVouchers(userId: string): Promise<any[]> {
    const userVouchers = await this.prisma.userVoucher.findMany({
      where: {
        userId,
        isUsed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      include: {
        voucher: true,
      },
      orderBy: { claimedAt: 'desc' },
    });

    return userVouchers;
  }

  /**
   * Claim voucher
   */
  async claimVoucher(userId: string, voucherId: string): Promise<any> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId, isActive: true },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new BadRequestException('Voucher is not active');
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Voucher usage limit exceeded');
    }

    // Check user claim limit
    const userClaims = await this.prisma.userVoucher.count({
      where: {
        userId,
        voucherId,
      },
    });

    if (userClaims >= voucher.perUserLimit) {
      throw new BadRequestException('You have reached the limit for this voucher');
    }

    const userVoucher = await this.prisma.userVoucher.create({
      data: {
        userId,
        voucherId,
        claimedAt: now,
        expiresAt: voucher.endDate,
      },
      include: {
        voucher: true,
      },
    });

    this.logger.log(`User ${userId} claimed voucher ${voucher.code}`);

    return userVoucher;
  }

  /**
   * Apply voucher to checkout
   */
  async applyVoucher(
    userId: string,
    dto: ApplyVoucherDto,
  ): Promise<ApplyVoucherResponse> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: dto.voucherCode, isActive: true },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new BadRequestException('Voucher is not active');
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Voucher usage limit exceeded');
    }

    if (dto.cartTotal < voucher.minSpend) {
      throw new BadRequestException(
        `Minimum spend for this voucher is Rp ${voucher.minSpend.toLocaleString()}`,
      );
    }

    // Check if user already used this voucher (for perUserLimit)
    if (voucher.perUserLimit > 0) {
      const userUsage = await this.prisma.userVoucher.count({
        where: {
          userId,
          voucherId: voucher.id,
          isUsed: true,
        },
      });

      if (userUsage >= voucher.perUserLimit) {
        throw new BadRequestException('You have already used this voucher');
      }
    }

    let discountAmount = 0;

    if (voucher.discountType === VoucherDiscountType.PERCENTAGE) {
      discountAmount = Math.floor(dto.cartTotal * voucher.discountValue / 100);
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else if (voucher.discountType === VoucherDiscountType.FIXED_AMOUNT) {
      discountAmount = voucher.discountValue;
      if (discountAmount > dto.cartTotal) {
        discountAmount = dto.cartTotal;
      }
    } else if (voucher.discountType === VoucherDiscountType.FREE_SHIPPING) {
      // Free shipping handled separately in checkout
      discountAmount = 0;
    }

    const newTotal = dto.cartTotal - discountAmount;

    return {
      discountAmount,
      newTotal,
      voucher,
    };
  }

  /**
   * Use voucher after successful checkout
   */
  async useVoucher(userId: string, voucherCode: string, orderId: string): Promise<void> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: voucherCode },
    });

    if (!voucher) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Update voucher usage count
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { usedCount: { increment: 1 } },
      });

      // Mark user voucher as used
      await tx.userVoucher.updateMany({
        where: {
          userId,
          voucherId: voucher.id,
          isUsed: false,
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
          orderId,
        },
      });

      // Create master order voucher record
      await tx.masterOrderVoucher.create({
        data: {
          masterOrderId: orderId,
          voucherId: voucher.id,
          discountAmount: 0, // Will be updated with actual discount
        },
      });
    });

    this.logger.log(`User ${userId} used voucher ${voucherCode} for order ${orderId}`);
  }

  /**
   * Get voucher by code
   */
  async getVoucherByCode(code: string): Promise<any> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    return voucher;
  }

  /**
   * Deactivate voucher (admin/seller)
   */
  async deactivateVoucher(voucherId: string, userId: string, role: string): Promise<void> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    // Check permission
    if (role !== 'admin' && voucher.sellerId !== userId) {
      throw new BadRequestException('You do not have permission to deactivate this voucher');
    }

    await this.prisma.voucher.update({
      where: { id: voucherId },
      data: { isActive: false },
    });

    this.logger.log(`Voucher ${voucher.code} deactivated by ${userId}`);
  }

  /**
   * Get seller's voucher statistics
   */
  async getSellerVoucherStats(sellerId: string): Promise<any> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { sellerId, type: VoucherType.SELLER },
      include: {
        userVouchers: {
          where: { isUsed: true },
        },
      },
    });

    const stats = {
      totalVouchers: vouchers.length,
      activeVouchers: vouchers.filter((v) => v.isActive).length,
      totalUsed: vouchers.reduce((sum, v) => sum + v.usedCount, 0),
      vouchers: vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        discountValue: v.discountValue,
        discountType: v.discountType,
        usedCount: v.usedCount,
        isActive: v.isActive,
        startDate: v.startDate,
        endDate: v.endDate,
      })),
    };

    return stats;
  }
}
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrismaService = {
  product: {
    findFirst: jest.fn(),
  },
  wishlist: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WishlistService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addToWishlist', () => {
    it('should add product to wishlist successfully', async () => {
      const userId = 'user_001';
      const productId = 'prod_001';
      const product = { id: productId, isActive: true, deletedAt: null };
      const wishlistItem = { id: 'wl_001', userId, productId };

      mockPrismaService.product.findFirst.mockResolvedValue(product);
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);
      mockPrismaService.wishlist.create.mockResolvedValue(wishlistItem);

      const result = await service.addToWishlist(userId, productId);
      expect(result).toEqual(wishlistItem);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.addToWishlist('user_001', 'invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already in wishlist', async () => {
      const userId = 'user_001';
      const productId = 'prod_001';
      const product = { id: productId, isActive: true, deletedAt: null };
      const existingWishlist = { id: 'wl_001', userId, productId };

      mockPrismaService.product.findFirst.mockResolvedValue(product);
      mockPrismaService.wishlist.findUnique.mockResolvedValue(existingWishlist);

      await expect(service.addToWishlist(userId, productId)).rejects.toThrow(ConflictException);
    });
  });

  describe('removeFromWishlist', () => {
    it('should remove product from wishlist', async () => {
      const wishlistItem = { id: 'wl_001', userId: 'user_001', productId: 'prod_001' };
      mockPrismaService.wishlist.findUnique.mockResolvedValue(wishlistItem);
      mockPrismaService.wishlist.delete.mockResolvedValue(wishlistItem);

      await expect(service.removeFromWishlist('user_001', 'prod_001')).resolves.not.toThrow();
    });

    it('should throw NotFoundException if not in wishlist', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);

      await expect(service.removeFromWishlist('user_001', 'prod_001')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('isInWishlist', () => {
    it('should return true if product in wishlist', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue({ id: 'wl_001' });

      const result = await service.isInWishlist('user_001', 'prod_001');
      expect(result).toBe(true);
    });

    it('should return false if product not in wishlist', async () => {
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);

      const result = await service.isInWishlist('user_001', 'prod_001');
      expect(result).toBe(false);
    });
  });
});

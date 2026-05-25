import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventProducer } from '../../queue/producers/event.producer';

const mockPrismaService = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findFirst: jest.fn(),
  },
  productImage: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  productVariant: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  wishlist: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

const mockEventProducer = {
  publish: jest.fn(),
};

describe('ProductService', () => {
  let service: ProductService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventProducer, useValue: mockEventProducer },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const sellerId = 'seller_001';
      const createDto = {
        name: 'Kaos Polos',
        slug: 'kaos-polos',
        price: 50000,
        stock: 100,
        weightGram: 200,
      };
      const expectedProduct = { id: 'prod_001', ...createDto, sellerId };

      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockResolvedValue(expectedProduct);

      const result = await service.create(sellerId, createDto);
      expect(result).toEqual(expectedProduct);
    });

    it('should throw ConflictException if slug exists', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('seller_001', {
          name: 'Test',
          slug: 'test',
          price: 1000,
          stock: 1,
          weightGram: 100,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return product if found and increment view', async () => {
      const product = {
        id: 'prod_001',
        name: 'Kaos Polos',
        sellerId: 'seller_001',
        deletedAt: null,
        seller: { full_name: 'Toko A' },
        category: null,
        images: [],
        variants: [],
        reviews: [],
        _count: { reviews: 0, wishlists: 0 },
      };
      mockPrismaService.product.findFirst.mockResolvedValue(product);
      mockPrismaService.product.update.mockResolvedValue(product);
      mockPrismaService.wishlist.findUnique.mockResolvedValue(null);

      const result = await service.findOne('prod_001');
      expect(result.id).toBe('prod_001');
      expect(mockPrismaService.product.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product if owner', async () => {
      const product = {
        id: 'prod_001',
        sellerId: 'seller_001',
        price: 50000,
        stock: 100,
      };
      mockPrismaService.product.findFirst.mockResolvedValue(product);
      mockPrismaService.$transaction.mockResolvedValue({ ...product, price: 60000 });
      mockPrismaService.product.update.mockResolvedValue({ ...product, price: 60000 });

      const result = await service.update('seller_001', 'prod_001', { price: 60000 });
      expect(result.price).toBe(60000);
    });

    it('should throw ForbiddenException if not owner', async () => {
      const product = { id: 'prod_001', sellerId: 'other_seller' };
      mockPrismaService.product.findFirst.mockResolvedValue(product);

      await expect(service.update('seller_001', 'prod_001', { price: 60000 })).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('remove', () => {
    it('should soft delete product if owner', async () => {
      const product = { id: 'prod_001', sellerId: 'seller_001' };
      mockPrismaService.product.findFirst.mockResolvedValue(product);
      mockPrismaService.product.update.mockResolvedValue({ ...product, deletedAt: new Date() });

      const result = await service.remove('seller_001', 'prod_001');
      expect(result.deletedAt).toBeDefined();
    });
  });
});

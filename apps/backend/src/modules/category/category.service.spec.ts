import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrismaService = {
  category: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category successfully', async () => {
      const createDto = {
        name: 'Elektronik',
        slug: 'elektronik',
        level: 0,
      };
      const expectedCategory = { id: 'cat_001', ...createDto, deletedAt: null };

      mockPrismaService.category.findUnique.mockResolvedValue(null);
      mockPrismaService.category.create.mockResolvedValue(expectedCategory);

      const result = await service.create(createDto);
      expect(result).toEqual(expectedCategory);
      expect(mockPrismaService.category.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug already exists', async () => {
      const createDto = { name: 'Elektronik', slug: 'elektronik' };
      mockPrismaService.category.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return category if found', async () => {
      const category = { id: 'cat_001', name: 'Elektronik', deletedAt: null };
      mockPrismaService.category.findFirst.mockResolvedValue(category);

      const result = await service.findOne('cat_001');
      expect(result).toEqual(category);
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne('not_exist')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete category', async () => {
      const category = { id: 'cat_001', name: 'Elektronik' };
      mockPrismaService.category.findFirst.mockResolvedValue(category);
      mockPrismaService.category.findMany.mockResolvedValue([]);
      mockPrismaService.category.update.mockResolvedValue({ ...category, deletedAt: new Date() });

      const result = await service.remove('cat_001');
      expect(result.deletedAt).toBeDefined();
    });
  });
});
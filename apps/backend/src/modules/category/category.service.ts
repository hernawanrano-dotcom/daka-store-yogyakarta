import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, Prisma } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateCategoryDto): Promise<Category> {
    // Cek slug unik
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug ${data.slug} already exists`);
    }

    // Cek parent exists jika ada parentId
    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category with id ${data.parentId} not found`);
      }
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        image: data.image,
        parentId: data.parentId,
        level: data.level ?? 0,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findTree(): Promise<any[]> {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return categories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    return buildTree(null);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }
    return category;
  }

  async update(id: string, data: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id); // Check exists

    // Cek slug unik (kecuali dirinya sendiri)
    if (data.slug) {
      const existing = await this.prisma.category.findFirst({
        where: { slug: data.slug, id: { not: id }, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(`Category with slug ${data.slug} already exists`);
      }
    }

    // Cek parent valid (tidak boleh refer ke diri sendiri)
    if (data.parentId === id) {
      throw new ConflictException('Category cannot be parent of itself');
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        image: data.image,
        parentId: data.parentId,
        level: data.level,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
  }

  async remove(id: string): Promise<Category> {
    await this.findOne(id);

    // Check if has children
    const children = await this.prisma.category.findMany({
      where: { parentId: id, deletedAt: null },
    });
    if (children.length > 0) {
      throw new ConflictException('Cannot delete category with children. Delete children first.');
    }

    // Soft delete
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!category) {
      throw new NotFoundException(`Deleted category with id ${id} not found`);
    }

    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}

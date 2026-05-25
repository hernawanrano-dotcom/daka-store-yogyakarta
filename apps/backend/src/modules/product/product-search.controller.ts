import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MeilisearchClient } from '../../../../infrastructure/meilisearch/meilisearch.client';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/v1/products/search')
export class ProductSearchController {
  constructor(private readonly meilisearch: MeilisearchClient) {}

  @Get()
  @Public()
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('categoryId') categoryId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('sort') sort?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 20;
    const offset = page ? (parseInt(page) - 1) * limitNum : 0;

    // Build filter
    const filters: string[] = [];
    filters.push('isActive = true');

    if (categoryId) {
      filters.push(`categoryId = "${categoryId}"`);
    }

    if (minPrice || maxPrice) {
      const priceFilters: string[] = [];
      if (minPrice) priceFilters.push(`price >= ${parseInt(minPrice)}`);
      if (maxPrice) priceFilters.push(`price <= ${parseInt(maxPrice)}`);
      filters.push(priceFilters.join(' AND '));
    }

    if (minRating) {
      filters.push(`ratingAvg >= ${parseFloat(minRating)}`);
    }

    const filterString = filters.length > 0 ? filters.join(' AND ') : undefined;

    // Build sort
    let sortArray: string[] | undefined;
    if (sort) {
      switch (sort) {
        case 'price_asc':
          sortArray = ['price:asc'];
          break;
        case 'price_desc':
          sortArray = ['price:desc'];
          break;
        case 'newest':
          sortArray = ['createdAt:desc'];
          break;
        case 'popular':
          sortArray = ['soldCount:desc'];
          break;
        case 'rating':
          sortArray = ['ratingAvg:desc'];
          break;
      }
    }

    const results = await this.meilisearch.searchProducts(query || '', {
      limit: limitNum,
      offset,
      filter: filterString,
      sort: sortArray,
    });

    return {
      success: true,
      message: 'Search results retrieved',
      data: results.hits,
      meta: {
        page: page ? parseInt(page) : 1,
        limit: limitNum,
        total: results.estimatedTotalHits,
        totalPages: Math.ceil(results.estimatedTotalHits / limitNum),
        processingTimeMs: results.processingTimeMs,
      },
    };
  }

  @Get('suggest')
  @Public()
  async suggest(@Query('q') query: string) {
    const results = await this.meilisearch.searchProducts(query || '', {
      limit: 5,
    });

    return {
      success: true,
      message: 'Search suggestions retrieved',
      data: results.hits.map((hit: any) => ({
        id: hit.id,
        name: hit.name,
        slug: hit.slug,
        price: hit.price,
        image: hit.images?.[0] || null,
      })),
    };
  }
}
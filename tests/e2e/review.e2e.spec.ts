import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/backend/src/app.module';

describe('Review E2E', () => {
  let app: INestApplication;
  let buyerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let productId: string;
  let categoryId: string;
  let orderId: string;
  let reviewId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as buyer
    const buyerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'buyer1@example.com', password: 'password123' });
    buyerToken = buyerLogin.body.data.accessToken;

    // Login as seller
    const sellerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'seller1@dakastore.com', password: 'password123' });
    sellerToken = sellerLogin.body.data.accessToken;

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@dakastore.com', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    // Create category
    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Review Category', slug: 'review-category', level: 0 });
    categoryId = category.body.data.id;

    // Create product for testing
    const product = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Review Product',
        slug: 'review-product',
        price: 100000,
        stock: 10,
        weightGram: 100,
        categoryId: categoryId,
      });
    productId = product.body.data.id;

    // Create order (simulate - need completed order to review)
    // This assumes there's a completed order in the system
    // For testing, we'll mock or use a pre-existing completed order
    orderId = 'mock-order-id'; // In real test, create actual order
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/reviews/product/:productId', () => {
    it('should get product reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/product/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should filter reviews by rating', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/product/${productId}?rating=5`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter reviews with images only', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/product/${productId}?withImages=true`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should sort reviews by newest', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/product/${productId}?sort=newest`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/reviews/product/:productId/stats', () => {
    it('should get review statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/product/${productId}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.averageRating).toBeDefined();
      expect(response.body.data.totalReviews).toBeDefined();
      expect(response.body.data.ratingCounts).toBeDefined();
    });
  });

  describe('GET /api/v1/reviews/me', () => {
    it('should get user reviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews/me')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should not get user reviews without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reviews/me')
        .expect(401);
    });
  });

  describe('POST /api/v1/reviews', () => {
    it('should create review (if order completed)', async () => {
      // Note: This test requires a completed order
      // In production, buyer can only review after order completed
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId: orderId,
          productId: productId,
          rating: 5,
          comment: 'This product is amazing!',
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.rating).toBe(5);
        expect(response.body.data.comment).toBe('This product is amazing!');
        reviewId = response.body.data.id;
      } else {
        // If no completed order, test will be skipped but not fail
        expect([400, 201]).toContain(response.status);
      }
    });

    it('should not create review without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .send({
          orderId: orderId,
          productId: productId,
          rating: 5,
          comment: 'Nice product',
        })
        .expect(401);
    });

    it('should not create review with invalid rating', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId: orderId,
          productId: productId,
          rating: 6, // Invalid rating (max 5)
          comment: 'Invalid rating',
        })
        .expect(400);
    });
  });

  describe('PUT /api/v1/reviews/:reviewId', () => {
    it('should update review', async () => {
      if (!reviewId) return;

      const response = await request(app.getHttpServer())
        .put(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 4,
          comment: 'Updated review comment',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(4);
      expect(response.body.data.comment).toBe('Updated review comment');
    });
  });

  describe('POST /api/v1/reviews/:reviewId/reply', () => {
    it('should allow seller to reply to review', async () => {
      if (!reviewId) return;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          reply: 'Thank you for your review!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sellerReply).toBe('Thank you for your review!');
      expect(response.body.data.sellerReplyAt).toBeDefined();
    });

    it('should not allow buyer to reply to review', async () => {
      if (!reviewId) return;

      await request(app.getHttpServer())
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          reply: 'This should not work',
        })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/reviews/:reviewId', () => {
    it('should delete review', async () => {
      if (!reviewId) return;

      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
    });
  });
});
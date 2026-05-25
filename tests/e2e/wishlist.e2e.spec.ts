import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/backend/src/app.module';

describe('Wishlist E2E', () => {
  let app: INestApplication;
  let buyerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let productId: string;
  let categoryId: string;

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
      .send({ name: 'Wishlist Category', slug: 'wishlist-category', level: 0 });
    categoryId = category.body.data.id;

    // Create product for testing
    const product = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Wishlist Product',
        slug: 'wishlist-product',
        price: 100000,
        stock: 10,
        weightGram: 100,
        categoryId: categoryId,
      });
    productId = product.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/wishlist', () => {
    it('should add product to wishlist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.productId).toBe(productId);
    });

    it('should not add duplicate product to wishlist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId })
        .expect(409);
    });

    it('should not add product to wishlist without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/wishlist')
        .send({ productId })
        .expect(401);
    });

    it('should not add non-existent product to wishlist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: 'non-existent-id' })
        .expect(404);
    });
  });

  describe('GET /api/v1/wishlist', () => {
    it('should get user wishlist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get wishlist with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist?page=1&limit=5')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
    });

    it('should not get wishlist without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .expect(401);
    });
  });

  describe('GET /api/v1/wishlist/check/:productId', () => {
    it('should check if product in wishlist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/wishlist/check/${productId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isInWishlist).toBe(true);
    });

    it('should return false for product not in wishlist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wishlist/check/non-existent-product')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.data.isInWishlist).toBe(false);
    });
  });

  describe('DELETE /api/v1/wishlist/:productId', () => {
    it('should remove product from wishlist', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
    });

    it('should return 404 when removing non-existent wishlist item', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/wishlist/non-existent')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/wishlist', () => {
    it('should clear entire wishlist', async () => {
      // Add item first
      await request(app.getHttpServer())
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId });

      // Clear wishlist
      await request(app.getHttpServer())
        .delete('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // Verify empty
      const wishlist = await request(app.getHttpServer())
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(wishlist.body.data.length).toBe(0);
    });
  });
});
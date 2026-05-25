import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/backend/src/app.module';

describe('Product E2E', () => {
  let app: INestApplication;
  let sellerToken: string;
  let buyerToken: string;
  let adminToken: string;
  let productId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as seller
    const sellerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'seller1@dakastore.com', password: 'password123' });
    sellerToken = sellerLogin.body.data.accessToken;

    // Login as buyer
    const buyerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'buyer1@example.com', password: 'password123' });
    buyerToken = buyerLogin.body.data.accessToken;

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@dakastore.com', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    // Create category first
    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Category', slug: 'test-category', level: 0 });
    categoryId = category.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/products', () => {
    it('should return list of products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should filter products by category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products?categoryId=${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter products by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?minPrice=10000&maxPrice=100000')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should sort products by price ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?sort=price_asc')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/products', () => {
    it('should create product as seller', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Test Product E2E',
          slug: 'test-product-e2e',
          description: 'This is a test product',
          price: 100000,
          stock: 50,
          weightGram: 500,
          categoryId: categoryId,
          isActive: true,
          variants: [
            { name: 'Merah', priceAdjust: 0, stock: 25 },
            { name: 'Biru', priceAdjust: 0, stock: 25 },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Product E2E');
      expect(response.body.data.price).toBe(100000);
      productId = response.body.data.id;
    });

    it('should not create product without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Unauthorized Product',
          slug: 'unauth-product',
          price: 100000,
          stock: 10,
          weightGram: 100,
        })
        .expect(401);
    });

    it('should not create product with duplicate slug', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Duplicate Product',
          slug: 'test-product-e2e', // duplicate slug
          price: 100000,
          stock: 10,
          weightGram: 100,
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('should get product detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(productId);
      expect(response.body.data.name).toBe('Test Product E2E');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /api/v1/products/:id', () => {
    it('should update product as seller', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Updated Product E2E',
          price: 120000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Product E2E');
      expect(response.body.data.price).toBe(120000);
    });

    it('should not update product as buyer', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  describe('GET /api/v1/products/search', () => {
    it('should search products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should search with filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/search?q=test&categoryId=${categoryId}&minPrice=50000&maxPrice=150000`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search/suggest?q=tes')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('should delete product as seller', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
    });

    it('should return 404 for deleted product', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(404);
    });
  });
});
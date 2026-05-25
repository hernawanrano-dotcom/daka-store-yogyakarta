import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/backend/src/app.module';

describe('Category E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let buyerToken: string;
  let categoryId: string;
  let childCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@dakastore.com', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    // Login as buyer
    const buyerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'buyer1@example.com', password: 'password123' });
    buyerToken = buyerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/categories', () => {
    it('should return list of categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return category tree', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories?tree=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should create category as admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Electronics',
          slug: 'electronics',
          description: 'Electronic products',
          level: 0,
          sortOrder: 1,
          isActive: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Electronics');
      expect(response.body.data.slug).toBe('electronics');
      categoryId = response.body.data.id;
    });

    it('should create child category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Smartphones',
          slug: 'smartphones',
          parentId: categoryId,
          level: 1,
          sortOrder: 1,
          isActive: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Smartphones');
      expect(response.body.data.parentId).toBe(categoryId);
      childCategoryId = response.body.data.id;
    });

    it('should not create category without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'Unauthorized Category',
          slug: 'unauthorized',
        })
        .expect(401);
    });

    it('should not create category as buyer', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Buyer Category',
          slug: 'buyer-category',
        })
        .expect(403);
    });

    it('should not create category with duplicate slug', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Electronics',
          slug: 'electronics', // duplicate slug
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should get category by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(categoryId);
      expect(response.body.data.name).toBe('Electronics');
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/non-existent-id')
        .expect(404);
    });
  });

  describe('GET /api/v1/categories/slug/:slug', () => {
    it('should get category by slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/slug/electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('electronics');
    });
  });

  describe('PUT /api/v1/categories/:id', () => {
    it('should update category as admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Electronics Updated',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Electronics Updated');
      expect(response.body.data.description).toBe('Updated description');
    });
  });

  describe('Category Tree', () => {
    it('should have parent-child relationship', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories?tree=true')
        .expect(200);

      const electronics = response.body.data.find((c: any) => c.id === categoryId);
      expect(electronics).toBeDefined();
      expect(electronics.children).toBeDefined();
      expect(electronics.children.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete child category first', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${childCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should delete parent category', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should not delete category that has children', async () => {
      // This test requires a category with children that hasn't been deleted
      // Create category with child, then try to delete parent without deleting child
      // Expect 409 Conflict
    });
  });

  describe('POST /api/v1/categories/:id/restore', () => {
    it('should restore deleted category', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/categories/${categoryId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(categoryId);
      expect(response.body.data.deletedAt).toBeNull();
    });
  });
});
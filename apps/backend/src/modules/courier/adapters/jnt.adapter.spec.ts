// apps/backend/src/modules/courier/adapters/jnt.adapter.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { JntAdapter } from './jnt.adapter';
import { RateParams, OrderParams } from '../interfaces/courier.adapter.interface';

describe('JntAdapter', () => {
  let adapter: JntAdapter;

  beforeAll(() => {
    // Set mock env
    process.env.JNT_API_KEY = 'test-api-key';
    process.env.JNT_BASE_URL = 'https://api.jnt.co.id';
    process.env.JNT_IS_PRODUCTION = 'false';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JntAdapter],
    }).compile();

    adapter = module.get<JntAdapter>(JntAdapter);
  });

  describe('getName', () => {
    it('should return JNT', () => {
      expect(adapter.getName()).toBe('JNT');
    });
  });

  describe('supportsWebhook', () => {
    it('should return true', () => {
      expect(adapter.supportsWebhook()).toBe(true);
    });
  });

  describe('supportsPolling', () => {
    it('should return true', () => {
      expect(adapter.supportsPolling()).toBe(true);
    });
  });

  describe('getRates', () => {
    const mockParams: RateParams = {
      originLat: -7.7956,
      originLng: 110.3695,
      destLat: -7.7956,
      destLng: 110.3695,
      weightGram: 1000,
      itemType: 'package',
    };

    it('should return rates array', async () => {
      const rates = await adapter.getRates(mockParams);

      expect(rates).toBeDefined();
      expect(Array.isArray(rates)).toBe(true);
      expect(rates.length).toBeGreaterThan(0);

      const firstRate = rates[0];
      expect(firstRate.courierName).toBe('JNT');
      expect(firstRate.price).toBeGreaterThan(0);
      expect(firstRate.estimatedDays).toBeDefined();
    });

    it('should include Reguler service', async () => {
      const rates = await adapter.getRates(mockParams);
      const regulerService = rates.find((r) => r.service === 'Reguler');

      expect(regulerService).toBeDefined();
      expect(regulerService?.price).toBeGreaterThan(0);
    });

    it('should include Express service', async () => {
      const rates = await adapter.getRates(mockParams);
      const expressService = rates.find((r) => r.service === 'Express');

      expect(expressService).toBeDefined();
      expect(expressService?.price).toBeGreaterThan(0);
    });
  });

  describe('createOrder', () => {
    const mockOrderParams: OrderParams = {
      subOrderId: 'sub_123',
      fromAddress: {
        name: 'Sender Name',
        phone: '081234567890',
        address: 'Jl. Malioboro No 1',
        lat: -7.7956,
        lng: 110.3695,
        postalCode: '55221',
      },
      toAddress: {
        name: 'Receiver Name',
        phone: '081234567891',
        address: 'Jl. Sudirman No 2',
        lat: -7.7833,
        lng: 110.3667,
        postalCode: '55222',
      },
      items: [
        {
          name: 'Product 1',
          quantity: 1,
          weightGram: 500,
          price: 50000,
        },
      ],
      paymentMethod: 'digital',
    };

    it('should return order result', async () => {
      const result = await adapter.createOrder(mockOrderParams);

      expect(result).toBeDefined();
      expect(result.orderId).toBeDefined();
      expect(result.trackingNumber).toBeDefined();
      expect(result.price).toBeGreaterThan(0);
    });

    it('should generate unique tracking number', async () => {
      const result1 = await adapter.createOrder(mockOrderParams);
      const result2 = await adapter.createOrder(mockOrderParams);

      expect(result1.trackingNumber).not.toBe(result2.trackingNumber);
    });
  });

  describe('trackOrder', () => {
    it('should return tracking status for valid tracking number', async () => {
      const trackingNumber = 'JNT1234567890';
      const status = await adapter.trackOrder(trackingNumber);

      expect(status).toBeDefined();
      expect(['pending', 'picked_up', 'in_transit', 'delivered']).toContain(status.status);
      expect(status.location).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it('should handle invalid tracking number gracefully', async () => {
      const status = await adapter.trackOrder('INVALID');

      expect(status).toBeDefined();
      expect(status.status).toBeDefined();
    });
  });

  describe('cancelOrder', () => {
    it('should return true for cancel attempt', async () => {
      const result = await adapter.cancelOrder('order_123');

      expect(result).toBe(true);
    });
  });
});

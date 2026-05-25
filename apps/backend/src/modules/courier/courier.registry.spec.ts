// apps/backend/src/modules/courier/courier.registry.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { CourierRegistry } from './courier.registry';
import { CourierAdapter, RateParams } from './interfaces/courier.adapter.interface';

// Mock Adapters
const mockJntAdapter = {
  getName: jest.fn().mockReturnValue('JNT'),
  getRates: jest.fn(),
  supportsWebhook: jest.fn().mockReturnValue(true),
  supportsPolling: jest.fn().mockReturnValue(true),
};

const mockGojekAdapter = {
  getName: jest.fn().mockReturnValue('GOJEK'),
  getRates: jest.fn(),
  supportsWebhook: jest.fn().mockReturnValue(true),
  supportsPolling: jest.fn().mockReturnValue(true),
};

const mockHeronaAdapter = {
  getName: jest.fn().mockReturnValue('HERONA'),
  getRates: jest.fn(),
  supportsWebhook: jest.fn().mockReturnValue(false),
  supportsPolling: jest.fn().mockReturnValue(true),
};

describe('CourierRegistry', () => {
  let registry: CourierRegistry;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourierRegistry,
        { provide: 'JntAdapter', useValue: mockJntAdapter },
        { provide: 'GojekAdapter', useValue: mockGojekAdapter },
        { provide: 'HeronaAdapter', useValue: mockHeronaAdapter },
      ],
    }).compile();

    registry = module.get<CourierRegistry>(CourierRegistry);

    // Manually register adapters
    registry.registerAdapter('JNT', mockJntAdapter as unknown as CourierAdapter);
    registry.registerAdapter('GOJEK', mockGojekAdapter as unknown as CourierAdapter);
    registry.registerAdapter('HERONA', mockHeronaAdapter as unknown as CourierAdapter);
  });

  describe('registerAdapter', () => {
    it('should register adapter successfully', () => {
      const mockAdapter = {
        getName: jest.fn().mockReturnValue('TEST'),
      } as unknown as CourierAdapter;

      registry.registerAdapter('TEST', mockAdapter);

      expect(registry.getAvailableCouriers()).toContain('TEST');
    });
  });

  describe('getAdapter', () => {
    it('should return adapter for existing courier', () => {
      const adapter = registry.getAdapter('JNT');

      expect(adapter).toBeDefined();
      expect(adapter.getName()).toBe('JNT');
    });

    it('should throw error for non-existing courier', () => {
      expect(() => registry.getAdapter('UNKNOWN')).toThrow("Courier adapter 'UNKNOWN' not found");
    });

    it('should be case insensitive', () => {
      const adapter = registry.getAdapter('jnt');

      expect(adapter).toBeDefined();
      expect(adapter.getName()).toBe('JNT');
    });
  });

  describe('getAvailableCouriers', () => {
    it('should return list of registered couriers', () => {
      const couriers = registry.getAvailableCouriers();

      expect(couriers).toContain('JNT');
      expect(couriers).toContain('GOJEK');
      expect(couriers).toContain('HERONA');
      expect(couriers.length).toBe(3);
    });
  });

  describe('getRatesFromAll', () => {
    const mockParams: RateParams = {
      originLat: -7.7956,
      originLng: 110.3695,
      destLat: -7.7956,
      destLng: 110.3695,
      weightGram: 1000,
      itemType: 'package',
    };

    it('should return rates from all adapters', async () => {
      const mockJntRates = [{ courierName: 'JNT', price: 15000 }];
      const mockGojekRates = [{ courierName: 'GOJEK', price: 25000 }];

      mockJntAdapter.getRates.mockResolvedValue(mockJntRates);
      mockGojekAdapter.getRates.mockResolvedValue(mockGojekRates);
      mockHeronaAdapter.getRates.mockResolvedValue([]);

      const rates = await registry.getRatesFromAll(mockParams);

      expect(rates).toHaveLength(2);
      expect(rates[0].price).toBe(15000);
      expect(rates[1].price).toBe(25000);
    });

    it('should continue even if one adapter fails', async () => {
      mockJntAdapter.getRates.mockResolvedValue([{ courierName: 'JNT', price: 15000 }]);
      mockGojekAdapter.getRates.mockRejectedValue(new Error('API Error'));
      mockHeronaAdapter.getRates.mockResolvedValue([]);

      const rates = await registry.getRatesFromAll(mockParams);

      expect(rates).toHaveLength(1);
      expect(rates[0].courierName).toBe('JNT');
    });

    it('should throw error if all adapters fail', async () => {
      mockJntAdapter.getRates.mockRejectedValue(new Error('JNT Error'));
      mockGojekAdapter.getRates.mockRejectedValue(new Error('Gojek Error'));
      mockHeronaAdapter.getRates.mockRejectedValue(new Error('Herona Error'));

      await expect(registry.getRatesFromAll(mockParams)).rejects.toThrow('All couriers failed');
    });

    it('should sort rates by price ascending', async () => {
      const mockJntRates = [{ courierName: 'JNT', price: 30000 }];
      const mockGojekRates = [{ courierName: 'GOJEK', price: 15000 }];
      const mockHeronaRates = [{ courierName: 'HERONA', price: 20000 }];

      mockJntAdapter.getRates.mockResolvedValue(mockJntRates);
      mockGojekAdapter.getRates.mockResolvedValue(mockGojekRates);
      mockHeronaAdapter.getRates.mockResolvedValue(mockHeronaRates);

      const rates = await registry.getRatesFromAll(mockParams);

      expect(rates[0].price).toBe(15000);
      expect(rates[1].price).toBe(20000);
      expect(rates[2].price).toBe(30000);
    });
  });

  describe('supportsWebhook', () => {
    it('should return true for courier with webhook support', () => {
      expect(registry.supportsWebhook('JNT')).toBe(true);
      expect(registry.supportsWebhook('GOJEK')).toBe(true);
    });

    it('should return false for courier without webhook support', () => {
      expect(registry.supportsWebhook('HERONA')).toBe(false);
    });

    it('should return false for non-existing courier', () => {
      expect(registry.supportsWebhook('UNKNOWN')).toBe(false);
    });
  });

  describe('supportsPolling', () => {
    it('should return true for courier with polling support', () => {
      expect(registry.supportsPolling('JNT')).toBe(true);
      expect(registry.supportsPolling('GOJEK')).toBe(true);
      expect(registry.supportsPolling('HERONA')).toBe(true);
    });

    it('should return false for non-existing courier', () => {
      expect(registry.supportsPolling('UNKNOWN')).toBe(false);
    });
  });

  describe('getCourierCount', () => {
    it('should return number of registered couriers', () => {
      expect(registry.getCourierCount()).toBe(3);
    });
  });
});

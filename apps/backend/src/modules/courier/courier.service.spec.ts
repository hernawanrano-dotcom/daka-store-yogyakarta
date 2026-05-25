// apps/backend/src/modules/courier/courier.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CourierService } from './courier.service';
import { CourierRegistry } from './courier.registry';
import { RateParams, OrderParams } from './interfaces/courier.adapter.interface';

// Mock Queue
const mockQueue = {
  add: jest.fn(),
};

// Mock PrismaService
const mockPrismaService = {
  shipment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  courierLog: {
    create: jest.fn(),
  },
  trackingHistory: {
    create: jest.fn(),
  },
  outboxMessage: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

// Mock CourierRegistry
const mockRegistry = {
  getAdapter: jest.fn(),
  getRatesFromAll: jest.fn(),
  getAvailableCouriers: jest.fn(),
};

describe('CourierService', () => {
  let service: CourierService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourierService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CourierRegistry, useValue: mockRegistry },
        { provide: getQueueToken('tracking'), useValue: mockQueue },
        { provide: getQueueToken('polling'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CourierService>(CourierService);
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

    it('should return rates from all couriers when no courier specified', async () => {
      const mockRates = [
        { courierName: 'JNT', service: 'Reguler', price: 15000 },
        { courierName: 'GOJEK', service: 'Instant', price: 25000 },
      ];
      mockRegistry.getRatesFromAll.mockResolvedValue(mockRates);

      const rates = await service.getRates(mockParams);

      expect(rates).toEqual(mockRates);
      expect(mockRegistry.getRatesFromAll).toHaveBeenCalledWith(mockParams);
    });

    it('should return rates from specific courier when courierName provided', async () => {
      const mockAdapter = {
        getRates: jest.fn().mockResolvedValue([{ courierName: 'JNT', service: 'Reguler', price: 15000 }]),
      };
      mockRegistry.getAdapter.mockReturnValue(mockAdapter);

      const rates = await service.getRates(mockParams, 'JNT');

      expect(rates).toBeDefined();
      expect(mockRegistry.getAdapter).toHaveBeenCalledWith('JNT');
      expect(mockAdapter.getRates).toHaveBeenCalledWith(mockParams);
    });
  });

  describe('createShipment', () => {
    const mockOrderParams: OrderParams = {
      subOrderId: 'sub_123',
      fromAddress: {
        name: 'Sender',
        phone: '081234567890',
        address: 'Jl. Malioboro',
        lat: -7.7956,
        lng: 110.3695,
      },
      toAddress: {
        name: 'Receiver',
        phone: '081234567891',
        address: 'Jl. Sudirman',
        lat: -7.7833,
        lng: 110.3667,
      },
      items: [{ name: 'Product', quantity: 1, weightGram: 500, price: 50000 }],
      paymentMethod: 'digital',
    };

    const mockOrderResult = {
      orderId: 'JNT_123',
      trackingNumber: 'JNT123456',
      price: 15000,
    };

    const mockShipment = {
      id: 'ship_123',
      subOrderId: 'sub_123',
      courierName: 'JNT',
      trackingNumber: 'JNT123456',
    };

    it('should create shipment successfully', async () => {
      const mockAdapter = {
        getName: jest.fn().mockReturnValue('JNT'),
        createOrder: jest.fn().mockResolvedValue(mockOrderResult),
        supportsWebhook: jest.fn().mockReturnValue(true),
        supportsPolling: jest.fn().mockReturnValue(true),
      };
      mockRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockPrismaService.shipment.create.mockResolvedValue(mockShipment);
      mockPrismaService.outboxMessage.create.mockResolvedValue({});

      const result = await service.createShipment(mockOrderParams);

      expect(result).toEqual(mockOrderResult);
      expect(mockAdapter.createOrder).toHaveBeenCalledWith(mockOrderParams);
      expect(mockPrismaService.shipment.create).toHaveBeenCalled();
      expect(mockPrismaService.outboxMessage.create).toHaveBeenCalled();
    });

    it('should log courier action on success', async () => {
      const mockAdapter = {
        getName: jest.fn().mockReturnValue('JNT'),
        createOrder: jest.fn().mockResolvedValue(mockOrderResult),
        supportsWebhook: jest.fn().mockReturnValue(true),
        supportsPolling: jest.fn().mockReturnValue(true),
      };
      mockRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockPrismaService.shipment.create.mockResolvedValue(mockShipment);
      mockPrismaService.courierLog.create.mockResolvedValue({});

      await service.createShipment(mockOrderParams);

      expect(mockPrismaService.courierLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subOrderId: mockOrderParams.subOrderId,
          courierName: 'JNT',
          action: 'CREATE_ORDER',
          status: 'success',
        }),
      });
    });

    it('should throw error when courier fails', async () => {
      const mockAdapter = {
        getName: jest.fn().mockReturnValue('JNT'),
        createOrder: jest.fn().mockRejectedValue(new Error('Courier API error')),
      };
      mockRegistry.getAdapter.mockReturnValue(mockAdapter);

      await expect(service.createShipment(mockOrderParams)).rejects.toThrow('Failed to create shipment');

      expect(mockPrismaService.courierLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Courier API error',
        }),
      });
    });
  });

  describe('trackShipment', () => {
    it('should throw NotFoundException when shipment not found', async () => {
      mockPrismaService.shipment.findFirst.mockResolvedValue(null);

      await expect(service.trackShipment('invalid')).rejects.toThrow('Shipment with tracking number invalid not found');
    });

    it('should return tracking status for valid shipment', async () => {
      const mockShipment = {
        id: 'ship_123',
        courierName: 'JNT',
        trackingNumber: 'JNT123456',
      };
      const mockTrackingStatus = {
        status: 'in_transit',
        location: 'Jakarta',
        timestamp: new Date().toISOString(),
        description: 'Package in transit',
      };
      const mockAdapter = {
        trackOrder: jest.fn().mockResolvedValue(mockTrackingStatus),
      };

      mockPrismaService.shipment.findFirst.mockResolvedValue(mockShipment);
      mockRegistry.getAdapter.mockReturnValue(mockAdapter);
      mockPrismaService.$transaction.mockImplementation((callback) => callback(mockPrismaService));

      const result = await service.trackShipment('JNT123456');

      expect(result).toEqual(mockTrackingStatus);
      expect(mockAdapter.trackOrder).toHaveBeenCalledWith('JNT123456');
    });
  });
});
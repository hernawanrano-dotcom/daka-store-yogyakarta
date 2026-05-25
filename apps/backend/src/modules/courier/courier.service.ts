// apps/backend/src/modules/courier/courier.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CourierRegistry } from './courier.registry';
import {
  RateParams,
  Rate,
  OrderParams,
  OrderResult,
  TrackingStatus,
} from './interfaces/courier.adapter.interface';
import { CourierName, TrackingStatus as PrismaTrackingStatus } from '@prisma/client';

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);

  constructor(
    private prisma: PrismaService,
    private registry: CourierRegistry,
    @InjectQueue('tracking') private trackingQueue: Queue,
    @InjectQueue('polling') private pollingQueue: Queue
  ) {}

  /**
   * Hitung ongkir dari semua kurir atau kurir tertentu
   */
  async getRates(params: RateParams, courierName?: string): Promise<Rate[]> {
    this.logger.log(`Getting rates from ${courierName || 'all couriers'}`);

    if (courierName) {
      const adapter = this.registry.getAdapter(courierName);
      return await adapter.getRates(params);
    }

    return await this.registry.getRatesFromAll(params);
  }

  /**
   * Buat shipment order
   */
  async createShipment(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating shipment for subOrderId: ${params.subOrderId}`);

    // Pilih kurir (untuk sementara default ke JNT)
    // TODO: Implementasi pemilihan kurir berdasarkan preference seller
    const defaultCourier = 'JNT';
    const adapter = this.registry.getAdapter(defaultCourier);

    const startTime = Date.now();

    try {
      const result = await adapter.createOrder(params);

      // Log success
      await this.logCourierAction({
        subOrderId: params.subOrderId,
        courierName: adapter.getName(),
        action: 'CREATE_ORDER',
        requestPayload: params,
        responsePayload: result,
        status: 'success',
        durationMs: Date.now() - startTime,
      });

      // Save ke database
      const shipment = await this.prisma.shipment.create({
        data: {
          subOrderId: params.subOrderId,
          courierName: adapter.getName() as CourierName,
          courierService: result.orderId,
          trackingNumber: result.trackingNumber,
          status: 'PENDING',
          originAddress: params.fromAddress,
          destinationAddress: params.toAddress,
          weightGram: params.items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0),
          shippingFee: result.price,
        },
      });

      // Publish event via outbox
      await this.publishEvent('COURIER_ORDER_CREATED', {
        shipmentId: shipment.id,
        orderId: params.subOrderId,
        trackingNumber: result.trackingNumber,
        courierName: adapter.getName(),
      });

      // Queue tracking polling untuk kurir tanpa webhook
      if (!adapter.supportsWebhook() && adapter.supportsPolling()) {
        await this.addToPollingQueue(shipment.id, result.trackingNumber, adapter.getName());
      }

      return result;
    } catch (error) {
      // Log error
      await this.logCourierAction({
        subOrderId: params.subOrderId,
        courierName: adapter.getName(),
        action: 'CREATE_ORDER',
        requestPayload: params,
        responsePayload: null,
        status: 'failed',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });

      // Publish failure event via outbox
      await this.publishEvent('COURIER_FAILED', {
        shipmentId: null,
        orderId: params.subOrderId,
        reason: error.message,
      });

      throw new BadRequestException(`Failed to create shipment: ${error.message}`);
    }
  }

  /**
   * Lacak shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking shipment: ${trackingNumber}`);

    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with tracking number ${trackingNumber} not found`);
    }

    const adapter = this.registry.getAdapter(shipment.courierName);
    const trackingStatus = await adapter.trackOrder(trackingNumber);

    // Update database
    await this.updateTrackingStatus(shipment.id, trackingStatus);

    return trackingStatus;
  }

  /**
   * Update tracking status di database dan publish event
   */
  async updateTrackingStatus(shipmentId: string, trackingStatus: TrackingStatus): Promise<void> {
    const prismaStatus = this.mapTrackingStatus(trackingStatus.status);

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      this.logger.warn(`Shipment ${shipmentId} not found`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: prismaStatus,
          ...(trackingStatus.status === 'picked_up' && {
            pickedUpAt: new Date(trackingStatus.timestamp),
          }),
          ...(trackingStatus.status === 'delivered' && {
            deliveredAt: new Date(trackingStatus.timestamp),
          }),
        },
      });

      await tx.trackingHistory.create({
        data: {
          shipmentId,
          status: trackingStatus.status,
          location: trackingStatus.location,
          description: trackingStatus.description,
          rawResponse: trackingStatus.rawResponse,
        },
      });
    });

    // Publish event berdasarkan status (via outbox)
    if (trackingStatus.status === 'picked_up') {
      await this.publishEvent('COURIER_PICKED_UP', {
        shipmentId,
        orderId: shipment.subOrderId,
        pickedUpAt: trackingStatus.timestamp,
      });
    } else if (trackingStatus.status === 'delivered') {
      await this.publishEvent('COURIER_DELIVERED', {
        shipmentId,
        orderId: shipment.subOrderId,
        deliveredAt: trackingStatus.timestamp,
      });
    }

    await this.publishEvent('TRACKING_UPDATED', {
      shipmentId,
      orderId: shipment.subOrderId,
      status: trackingStatus.status,
      location: trackingStatus.location,
      timestamp: trackingStatus.timestamp,
    });
  }

  /**
   * Tambahkan shipment ke polling queue (untuk kurir tanpa webhook)
   */
  private async addToPollingQueue(
    shipmentId: string,
    trackingNumber: string,
    courierName: string
  ): Promise<void> {
    this.logger.log(`Adding shipment to polling queue: ${trackingNumber} for ${courierName}`);

    await this.pollingQueue.add(
      'poll-shipment',
      {
        shipmentId,
        trackingNumber,
        courierName,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        repeat: { pattern: '*/5 * * * *' }, // setiap 5 menit
      }
    );
  }

  /**
   * Log semua request/response ke CourierLog
   */
  private async logCourierAction(data: {
    subOrderId: string;
    courierName: string;
    action: string;
    requestPayload: any;
    responsePayload: any;
    status: string;
    errorMessage?: string;
    durationMs: number;
  }) {
    await this.prisma.courierLog.create({
      data: {
        subOrderId: data.subOrderId,
        courierName: data.courierName as CourierName,
        action: data.action,
        requestPayload: data.requestPayload,
        responsePayload: data.responsePayload,
        status: data.status,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
      },
    });
  }

  /**
   * Publish event via outbox pattern (WAJIB!)
   */
  private async publishEvent(eventName: string, payload: any): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        eventName,
        aggregateId: payload.shipmentId || payload.orderId,
        payload,
        status: 'pending',
      },
    });
    this.logger.debug(`Event ${eventName} saved to outbox`);
  }

  /**
   * Map tracking status ke Prisma enum
   */
  private mapTrackingStatus(status: string): PrismaTrackingStatus {
    const map: Record<string, PrismaTrackingStatus> = {
      pending: 'PENDING',
      picked_up: 'PICKED_UP',
      in_transit: 'IN_TRANSIT',
      delivered: 'DELIVERED',
      failed: 'FAILED',
      returned: 'RETURNED',
    };
    return map[status] || 'PENDING';
  }
}

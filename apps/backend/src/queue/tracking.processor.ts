// apps/backend/src/queue/tracking.processor.ts

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistry } from '../modules/courier/courier.registry';
import { CourierService } from '../modules/courier/courier.service';

@Processor('tracking')
export class TrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private registry: CourierRegistry,
    private courierService: CourierService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { courierName, payload, headers } = job.data;

    this.logger.log(`Processing tracking webhook from ${courierName}, jobId: ${job.id}`);

    try {
      const adapter = this.registry.getAdapter(courierName);

      // Panggil adapter untuk handle webhook
      await adapter.handleWebhook?.(payload, headers);

      // Extract tracking info dari payload (format beda per kurir)
      const trackingInfo = this.extractTrackingInfo(courierName, payload);

      if (trackingInfo) {
        // Update tracking status di database
        await this.courierService.updateTrackingStatus(trackingInfo.shipmentId, {
          status: trackingInfo.status,
          location: trackingInfo.location,
          timestamp: trackingInfo.timestamp,
          description: trackingInfo.description,
        });

        this.logger.log(`Tracking updated for shipment ${trackingInfo.shipmentId}: ${trackingInfo.status}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process tracking webhook: ${error.message}`, error.stack);
      throw error; // Akan retry sesuai konfigurasi
    }
  }

  /**
   * Extract tracking info dari payload sesuai format kurir
   */
  private extractTrackingInfo(
    courierName: string,
    payload: any,
  ): {
    shipmentId: string;
    status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned';
    location: string;
    timestamp: string;
    description: string;
  } | null {
    try {
      let trackingNumber: string;
      let status: string;
      let location: string;
      let timestamp: string;
      let description: string;

      switch (courierName.toUpperCase()) {
        case 'JNT':
          trackingNumber = payload.tracking_number || payload.awb;
          status = this.mapJntStatus(payload.status);
          location = payload.current_location || payload.city;
          timestamp = payload.timestamp || new Date().toISOString();
          description = payload.status_description || payload.note;
          break;

        case 'GOJEK':
          trackingNumber = payload.order_id || payload.tracking_number;
          status = this.mapGojekStatus(payload.status);
          location = payload.current_location;
          timestamp = payload.timestamp;
          description = payload.status_description;
          break;

        case 'GRAB':
          trackingNumber = payload.order_id || payload.tracking_number;
          status = this.mapGrabStatus(payload.status);
          location = payload.current_location;
          timestamp = payload.timestamp;
          description = payload.status_description;
          break;

        case 'DAKA_SAMEDAY':
        case 'DAKA_INSTANT':
          trackingNumber = payload.tracking_number;
          status = this.mapDakaStatus(payload.status);
          location = payload.location;
          timestamp = payload.event_time;
          description = payload.description;
          break;

        default:
          this.logger.warn(`Unknown courier: ${courierName}`);
          return null;
      }

      // Cari shipment berdasarkan tracking number
      const shipment = await this.prisma.shipment.findFirst({
        where: { trackingNumber },
      });

      if (!shipment) {
        this.logger.warn(`Shipment not found for tracking number: ${trackingNumber}`);
        return null;
      }

      return {
        shipmentId: shipment.id,
        status: this.normalizeStatus(status),
        location: location || '',
        timestamp: timestamp || new Date().toISOString(),
        description: description || '',
      };
    } catch (error) {
      this.logger.error(`Failed to extract tracking info: ${error.message}`);
      return null;
    }
  }

  private normalizeStatus(status: string): 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' {
    const normalized = status?.toLowerCase() || 'pending';
    if (normalized.includes('pick')) return 'picked_up';
    if (normalized.includes('transit') || normalized.includes('process')) return 'in_transit';
    if (normalized.includes('deliver')) return 'delivered';
    if (normalized.includes('fail') || normalized.includes('cancel')) return 'failed';
    if (normalized.includes('return')) return 'returned';
    return 'pending';
  }

  private mapJntStatus(status: string): string {
    const map: Record<string, string> = {
      WAITING: 'pending',
      PICKED: 'picked_up',
      PROCESSING: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      RETURNED: 'returned',
    };
    return map[status] || 'pending';
  }

  private mapGojekStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'pending',
      FINDING_DRIVER: 'pending',
      DRIVER_ASSIGNED: 'pending',
      PICKED_UP: 'picked_up',
      ON_DELIVERY: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      CANCELLED: 'failed',
    };
    return map[status] || 'pending';
  }

  private mapGrabStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'pending',
      ASSIGNED: 'pending',
      PICKED_UP: 'picked_up',
      IN_TRANSIT: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      CANCELLED: 'failed',
    };
    return map[status] || 'pending';
  }

  private mapDakaStatus(status: string): string {
    const map: Record<string, string> = {
      CREATED: 'pending',
      PICKED_UP: 'picked_up',
      ON_DELIVERY: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      RETURNED: 'returned',
    };
    return map[status] || 'pending';
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Tracking job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Tracking job ${job.id} failed: ${error.message}`);
  }
}
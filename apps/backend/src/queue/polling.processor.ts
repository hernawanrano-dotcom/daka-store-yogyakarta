// apps/backend/src/queue/polling.processor.ts

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistry } from '../modules/courier/courier.registry';
import { CourierService } from '../modules/courier/courier.service';

/**
 * POLLING PROCESSOR
 * Digunakan untuk kurir yang TIDAK memiliki webhook (Herona, POS)
 * Wajib polling setiap 5 menit untuk update tracking
 */
@Processor('polling')
export class PollingProcessor extends WorkerHost {
  private readonly logger = new Logger(PollingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private registry: CourierRegistry,
    private courierService: CourierService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { shipmentId, trackingNumber, courierName } = job.data;

    this.logger.log(`Polling tracking for ${courierName} shipment: ${trackingNumber}`);

    try {
      const adapter = this.registry.getAdapter(courierName);

      // Panggil API tracking
      const trackingStatus = await adapter.trackOrder(trackingNumber);

      // Update database
      await this.courierService.updateTrackingStatus(shipmentId, trackingStatus);

      this.logger.log(`Polling update for ${courierName}: ${trackingStatus.status}`);

      // Kalau status sudah final (delivered/failed), stop polling
      if (trackingStatus.status === 'delivered' || trackingStatus.status === 'failed' || trackingStatus.status === 'returned') {
        this.logger.log(`Final status reached for shipment ${shipmentId}, stopping polling`);
        return { success: true, stopPolling: true };
      }

      return { success: true, stopPolling: false };
    } catch (error) {
      this.logger.error(`Failed to poll tracking for ${courierName}: ${error.message}`);
      // Jangan throw, biar retry nanti
      return { success: false, error: error.message };
    }
  }

  /**
   * Cron job: polling semua shipment aktif setiap 5 menit
   * Khusus untuk kurir yang tidak support webhook (Herona, POS)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollAllActiveShipments() {
    this.logger.log('Running scheduled polling for all active shipments (no-webhook couriers)');

    // Cari semua shipment yang masih aktif (belum delivered/failed)
    // dan berasal dari kurir yang tidak support webhook
    const activeShipments = await this.prisma.shipment.findMany({
      where: {
        status: {
          in: ['PENDING', 'PICKED_UP', 'IN_TRANSIT'],
        },
        courierName: {
          in: ['HERONA', 'POS'], // Kurir tanpa webhook
        },
        createdAt: {
          gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Maks 14 hari
        },
      },
      select: {
        id: true,
        trackingNumber: true,
        courierName: true,
      },
    });

    this.logger.log(`Found ${activeShipments.length} active shipments to poll`);

    for (const shipment of activeShipments) {
      try {
        const adapter = this.registry.getAdapter(shipment.courierName);
        const trackingStatus = await adapter.trackOrder(shipment.trackingNumber);

        await this.courierService.updateTrackingStatus(shipment.id, trackingStatus);

        this.logger.debug(`Polled ${shipment.courierName} ${shipment.trackingNumber}: ${trackingStatus.status}`);
      } catch (error) {
        this.logger.error(`Failed to poll shipment ${shipment.id}: ${error.message}`);
      }
    }
  }

  /**
   * Tambahkan shipment ke polling queue (dipanggil saat create shipment)
   */
  async addToPollingQueue(shipmentId: string, trackingNumber: string, courierName: string) {
    this.logger.log(`Adding shipment to polling queue: ${trackingNumber}`);

    // Queue job dengan repeat pattern setiap 5 menit
    // Implementasi akan ditambahkan di courier.service.ts
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Polling job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Polling job ${job.id} failed: ${error.message}`);
  }
}
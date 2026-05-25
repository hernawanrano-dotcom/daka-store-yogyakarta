// apps/backend/src/modules/courier/webhook/webhook.controller.ts

import { Controller, Post, Param, Body, Headers, Req, HttpCode, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CourierRegistry } from '../courier.registry';
import { CourierService } from '../courier.service';

@Controller('courier/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly registry: CourierRegistry,
    private readonly courierService: CourierService,
    @InjectQueue('tracking') private trackingQueue: Queue,
  ) {}

  /**
   * POST /api/v1/courier/webhook/:courierName
   * Endpoint untuk menerima callback dari kurir
   * Wajib return 200 ASAP, jangan blocking!
   */
  @Post(':courierName')
  @HttpCode(200)
  async handleWebhook(
    @Param('courierName') courierName: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    this.logger.log(`Received webhook from ${courierName}`);

    try {
      const adapter = this.registry.getAdapter(courierName);

      // Verifikasi signature (wajib!)
      if (!this.verifySignature(courierName, payload, headers, req)) {
        this.logger.warn(`Invalid signature from ${courierName}`);
        return { success: true }; // Tetap return 200 biar provider gak retry terus
      }

      // Process webhook via queue (async, jangan blocking)
      await this.trackingQueue.add(
        'process-webhook',
        {
          courierName,
          payload,
          headers,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );

      this.logger.debug(`Webhook from ${courierName} queued for processing`);
    } catch (error) {
      this.logger.error(`Failed to process webhook from ${courierName}: ${error.message}`);
      // Jangan throw error, tetap return 200
    }

    // Selalu return 200 OK, biar provider gak retry terus
    return { success: true };
  }

  /**
   * Verifikasi signature webhook berdasarkan kurir
   */
  private verifySignature(
    courierName: string,
    payload: any,
    headers: Record<string, string>,
    req: any,
  ): boolean {
    // Untuk development, return true dulu
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    switch (courierName.toUpperCase()) {
      case 'JNT':
        return this.verifyJntSignature(payload, headers);
      case 'GOJEK':
        return this.verifyGojekSignature(payload, headers);
      case 'GRAB':
        return this.verifyGrabSignature(payload, headers);
      case 'DAKA_SAMEDAY':
      case 'DAKA_INSTANT':
        return this.verifyDakaSignature(payload, headers);
      default:
        // Kurir yang tidak support webhook atau belum implementasi
        this.logger.warn(`No signature verification for ${courierName}`);
        return true;
    }
  }

  /**
   * Verifikasi signature JNT
   */
  private verifyJntSignature(payload: any, headers: Record<string, string>): boolean {
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];
    const apiKey = process.env.JNT_API_KEY;

    if (!signature || !timestamp) {
      return false;
    }

    // Implementasi sesuai dokumentasi JNT
    // const expectedSignature = crypto.createHmac('sha256', apiKey).update(`${timestamp}.${JSON.stringify(payload)}`).digest('hex');
    // return signature === expectedSignature;

    return true; // Sementara
  }

  /**
   * Verifikasi signature Gojek
   */
  private verifyGojekSignature(payload: any, headers: Record<string, string>): boolean {
    const signature = headers['x-gojek-signature'];
    const clientSecret = process.env.GOJEK_CLIENT_SECRET;

    if (!signature) {
      return false;
    }

    // Implementasi sesuai dokumentasi Gojek
    return true;
  }

  /**
   * Verifikasi signature Grab
   */
  private verifyGrabSignature(payload: any, headers: Record<string, string>): boolean {
    const signature = headers['x-grab-signature'];
    const clientSecret = process.env.GRAB_CLIENT_SECRET;

    if (!signature) {
      return false;
    }

    // Implementasi sesuai dokumentasi Grab
    return true;
  }

  /**
   * Verifikasi signature Daka
   */
  private verifyDakaSignature(payload: any, headers: Record<string, string>): boolean {
    const signature = headers['x-daka-signature'];
    const apiKey = process.env.DAKA_SAMEDAY_API_KEY || process.env.DAKA_INSTANT_API_KEY;

    if (!signature) {
      return false;
    }

    // Implementasi sesuai dokumentasi Daka
    return true;
  }
}
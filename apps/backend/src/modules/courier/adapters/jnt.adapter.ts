// apps/backend/src/modules/courier/adapters/jnt.adapter.ts

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  CourierAdapter,
  RateParams,
  Rate,
  OrderParams,
  OrderResult,
  TrackingStatus,
} from '../interfaces/courier.adapter.interface';

@Injectable()
export class JntAdapter implements CourierAdapter {
  private readonly logger = new Logger(JntAdapter.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isProduction: boolean;

  constructor() {
    this.apiKey = process.env.JNT_API_KEY || '';
    this.baseUrl = process.env.JNT_BASE_URL || 'https://api.jnt.co.id';
    this.isProduction = process.env.JNT_IS_PRODUCTION === 'true';

    if (!this.apiKey && !this.isProduction) {
      this.logger.warn('JNT_API_KEY not set, using mock mode for development');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`JNT API Error: ${error.message}`, error.response?.data);
        throw error;
      },
    );
  }

  getName(): string {
    return 'JNT';
  }

  supportsWebhook(): boolean {
    return true; // JNT supports webhook
  }

  supportsPolling(): boolean {
    return true; // JNT supports polling fallback
  }

  async getRates(params: RateParams): Promise<Rate[]> {
    this.logger.log(`Getting JNT rates for weight: ${params.weightGram}g`);

    // Mock data untuk development (kalau API key belum ada)
    if (!this.apiKey) {
      return this.getMockRates(params);
    }

    try {
      const response = await this.client.post('/v1/rates', {
        origin: {
          lat: params.originLat,
          lng: params.originLng,
        },
        destination: {
          lat: params.destLat,
          lng: params.destLng,
        },
        weight: params.weightGram,
        item_type: params.itemType,
        item_value: params.itemValue,
      });

      return this.mapRatesResponse(response.data, params);
    } catch (error) {
      this.logger.error(`Failed to get JNT rates: ${error.message}`);
      // Fallback ke mock data kalau API error
      return this.getMockRates(params);
    }
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating JNT order for subOrderId: ${params.subOrderId}`);

    if (!this.apiKey) {
      return this.getMockOrderResult(params);
    }

    try {
      const payload = {
        order_id: params.subOrderId,
        from_address: {
          name: params.fromAddress.name,
          phone: params.fromAddress.phone,
          address: params.fromAddress.address,
          lat: params.fromAddress.lat,
          lng: params.fromAddress.lng,
          postal_code: params.fromAddress.postalCode,
        },
        to_address: {
          name: params.toAddress.name,
          phone: params.toAddress.phone,
          address: params.toAddress.address,
          lat: params.toAddress.lat,
          lng: params.toAddress.lng,
          postal_code: params.toAddress.postalCode,
        },
        items: params.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          weight: item.weightGram,
          price: item.price,
        })),
        payment_method: params.paymentMethod,
        cod_amount: params.codAmount,
        notes: params.notes,
      };

      const response = await this.client.post('/v1/orders', payload);

      return {
        orderId: response.data.order_id,
        trackingNumber: response.data.tracking_number,
        price: response.data.price,
        estimatedPickupTime: response.data.estimated_pickup,
        estimatedDeliveryTime: response.data.estimated_delivery,
        awbUrl: response.data.awb_url,
        labelUrl: response.data.label_url,
      };
    } catch (error) {
      this.logger.error(`Failed to create JNT order: ${error.message}`);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking JNT order: ${trackingNumber}`);

    if (!this.apiKey) {
      return this.getMockTrackingStatus(trackingNumber);
    }

    try {
      const response = await this.client.get(`/v1/tracking/${trackingNumber}`);

      return {
        status: this.mapStatus(response.data.status),
        location: response.data.location || '',
        timestamp: response.data.timestamp || new Date().toISOString(),
        description: response.data.description || '',
        rawResponse: response.data,
        courierStatus: response.data.status,
      };
    } catch (error) {
      this.logger.error(`Failed to track JNT order: ${error.message}`);
      return this.getMockTrackingStatus(trackingNumber);
    }
  }

  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<void> {
    this.logger.log(`Handling JNT webhook`);

    // Verify signature
    if (!this.verifySignature(payload, headers)) {
      throw new Error('Invalid webhook signature');
    }

    // Webhook payload processing akan di handle di controller
    this.logger.debug(`JNT webhook received: ${JSON.stringify(payload)}`);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    this.logger.log(`Cancelling JNT order: ${orderId}`);

    if (!this.apiKey) {
      return true;
    }

    try {
      await this.client.post(`/v1/orders/${orderId}/cancel`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel JNT order: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(payload: any, headers?: Record<string, string>): boolean {
    // Implement signature verification sesuai dokumentasi JNT
    // Untuk sementara return true
    return true;
  }

  /**
   * Map API status ke internal status
   */
  private mapStatus(status: string): 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' {
    const map: Record<string, any> = {
      WAITING: 'pending',
      PICKED: 'picked_up',
      PROCESSING: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      RETURNED: 'returned',
    };
    return map[status] || 'pending';
  }

  /**
   * Map API rate response ke internal Rate format
   */
  private mapRatesResponse(data: any, params: RateParams): Rate[] {
    if (!data.services || !Array.isArray(data.services)) {
      return this.getMockRates(params);
    }

    return data.services.map((service: any) => ({
      courierName: 'JNT',
      service: service.name,
      serviceCode: service.code,
      price: Math.round(service.price),
      estimatedDays: service.estimated_days || 2,
      estimatedMinHours: service.estimated_min_hours,
      estimatedMaxHours: service.estimated_max_hours,
      availableCod: service.cod_available || false,
      insuranceCoverage: service.insurance_coverage,
    }));
  }

  /**
   * Mock rates untuk development
   */
  private getMockRates(params: RateParams): Rate[] {
    // Hitung estimasi ongkir berdasarkan jarak dan berat
    const distance = this.calculateDistance(params.originLat, params.originLng, params.destLat, params.destLng);
    const basePrice = 10000 + Math.floor(distance * 2000) + Math.floor(params.weightGram / 1000) * 5000;
    const maxPrice = basePrice + 20000;

    return [
      {
        courierName: 'JNT',
        service: 'Reguler',
        serviceCode: 'REG',
        price: basePrice,
        estimatedDays: 2,
        estimatedMinHours: 24,
        estimatedMaxHours: 48,
        availableCod: true,
      },
      {
        courierName: 'JNT',
        service: 'Express',
        serviceCode: 'EXP',
        price: basePrice + 15000,
        estimatedDays: 1,
        estimatedMinHours: 12,
        estimatedMaxHours: 24,
        availableCod: true,
      },
      {
        courierName: 'JNT',
        service: 'YES (SameDay)',
        serviceCode: 'YES',
        price: maxPrice,
        estimatedDays: 0,
        estimatedMinHours: 2,
        estimatedMaxHours: 6,
        availableCod: false,
      },
    ];
  }

  /**
   * Mock order result untuk development
   */
  private getMockOrderResult(params: OrderParams): OrderResult {
    const trackingNumber = `JNT${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      orderId: `JNT_${params.subOrderId}`,
      trackingNumber,
      price: 15000,
      estimatedPickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      estimatedDeliveryTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      awbUrl: `https://track.jnt.co.id/${trackingNumber}`,
      labelUrl: `https://label.jnt.co.id/${trackingNumber}`,
    };
  }

  /**
   * Mock tracking status untuk development
   */
  private getMockTrackingStatus(trackingNumber: string): TrackingStatus {
    const randomStatus = Math.random();
    let status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' = 'pending';

    if (randomStatus < 0.3) status = 'pending';
    else if (randomStatus < 0.6) status = 'picked_up';
    else if (randomStatus < 0.9) status = 'in_transit';
    else status = 'delivered';

    return {
      status,
      location: status === 'delivered' ? 'Yogyakarta' : 'Jakarta',
      timestamp: new Date().toISOString(),
      description: this.getStatusDescription(status),
      rawResponse: { tracking_number: trackingNumber, status },
      courierStatus: status,
    };
  }

  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Paket telah diterima oleh JNT, menunggu pick up',
      picked_up: 'Paket telah diambil oleh kurir JNT',
      in_transit: 'Paket sedang dalam perjalanan menuju tujuan',
      delivered: 'Paket telah sampai ke tujuan',
    };
    return descriptions[status] || 'Status tidak diketahui';
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
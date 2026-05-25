// apps/backend/src/modules/courier/adapters/herona.adapter.ts

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

/**
 * HERONA EXPRESS ADAPTER
 * CATATAN PENTING:
 * - Herona TIDAK memiliki webhook
 * - WAJIB menggunakan polling fallback (setiap 5 menit)
 * - API menggunakan API Key authentication
 */
@Injectable()
export class HeronaAdapter implements CourierAdapter {
  private readonly logger = new Logger(HeronaAdapter.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isProduction: boolean;

  constructor() {
    this.apiKey = process.env.HERONA_API_KEY || '';
    this.baseUrl = process.env.HERONA_BASE_URL || 'https://api.herona.co.id';
    this.isProduction = process.env.HERONA_IS_PRODUCTION === 'true';

    if (!this.apiKey && !this.isProduction) {
      this.logger.warn('HERONA_API_KEY not set, using mock mode for development');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`Herona API Error: ${error.message}`, error.response?.data);
        throw error;
      },
    );
  }

  getName(): string {
    return 'HERONA';
  }

  /**
   * Herona TIDAK support webhook
   * WAJIB polling fallback
   */
  supportsWebhook(): boolean {
    return false;
  }

  /**
   * Herona support polling (wajib dijalankan setiap 5 menit)
   */
  supportsPolling(): boolean {
    return true;
  }

  async getRates(params: RateParams): Promise<Rate[]> {
    this.logger.log(`Getting Herona rates for weight: ${params.weightGram}g`);

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

      return this.mapRatesResponse(response.data);
    } catch (error) {
      this.logger.error(`Failed to get Herona rates: ${error.message}`);
      return this.getMockRates(params);
    }
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating Herona order for subOrderId: ${params.subOrderId}`);

    if (!this.apiKey) {
      return this.getMockOrderResult(params);
    }

    try {
      const totalWeight = params.items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0);

      const payload = {
        order_id: params.subOrderId,
        from: {
          name: params.fromAddress.name,
          phone: params.fromAddress.phone,
          address: params.fromAddress.address,
          lat: params.fromAddress.lat,
          lng: params.fromAddress.lng,
          postal_code: params.fromAddress.postalCode,
        },
        to: {
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
        total_weight: totalWeight,
        payment_method: params.paymentMethod,
        cod_amount: params.codAmount,
        notes: params.notes,
      };

      const response = await this.client.post('/v1/orders', payload);

      return {
        orderId: response.data.order_id,
        trackingNumber: response.data.tracking_number,
        price: response.data.price,
        estimatedPickupTime: response.data.estimated_pickup_time,
        estimatedDeliveryTime: response.data.estimated_delivery_time,
        awbUrl: response.data.awb_url,
        labelUrl: response.data.label_url,
      };
    } catch (error) {
      this.logger.error(`Failed to create Herona order: ${error.message}`);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking Herona order: ${trackingNumber}`);

    if (!this.apiKey) {
      return this.getMockTrackingStatus(trackingNumber);
    }

    try {
      const response = await this.client.get(`/v1/tracking/${trackingNumber}`);

      return {
        status: this.mapStatus(response.data.status),
        location: response.data.current_location || '',
        timestamp: response.data.timestamp || new Date().toISOString(),
        description: response.data.status_description || '',
        rawResponse: response.data,
        courierStatus: response.data.status,
      };
    } catch (error) {
      this.logger.error(`Failed to track Herona order: ${error.message}`);
      return this.getMockTrackingStatus(trackingNumber);
    }
  }

  /**
   * Herona TIDAK memiliki webhook
   * Method ini tetap ada untuk memenuhi interface, tapi tidak akan pernah dipanggil
   */
  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<void> {
    this.logger.warn('Herona does not support webhooks. Use polling instead.');
    // Tidak throw error, biar tidak crash
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    this.logger.log(`Cancelling Herona order: ${orderId}`);

    if (!this.apiKey) {
      return true;
    }

    try {
      await this.client.post(`/v1/orders/${orderId}/cancel`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel Herona order: ${error.message}`);
      return false;
    }
  }

  private mapStatus(status: string): 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' {
    const map: Record<string, any> = {
      WAITING: 'pending',
      PROCESSING: 'pending',
      PICKED_UP: 'picked_up',
      IN_TRANSIT: 'in_transit',
      ARRIVED: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      CANCELLED: 'failed',
      RETURNED: 'returned',
    };
    return map[status] || 'pending';
  }

  private mapRatesResponse(data: any): Rate[] {
    if (!data.services) {
      return this.getMockRates({} as RateParams);
    }

    return data.services.map((service: any) => ({
      courierName: 'HERONA',
      service: service.name,
      serviceCode: service.code,
      price: Math.round(service.price),
      estimatedDays: service.estimated_days || 2,
      estimatedMinHours: service.min_hours,
      estimatedMaxHours: service.max_hours,
      availableCod: service.cod_available || false,
    }));
  }

  private getMockRates(params: RateParams): Rate[] {
    const distance = this.calculateDistance(
      params.originLat || -7.7956,
      params.originLng || 110.3695,
      params.destLat || -7.7956,
      params.destLng || 110.3695,
    );
    const basePrice = 12000 + Math.floor(distance * 2500) + Math.floor((params.weightGram || 1000) / 1000) * 4000;

    return [
      {
        courierName: 'HERONA',
        service: 'Reguler',
        serviceCode: 'REG',
        price: basePrice,
        estimatedDays: 2,
        estimatedMinHours: 24,
        estimatedMaxHours: 48,
        availableCod: true,
      },
      {
        courierName: 'HERONA',
        service: 'Express',
        serviceCode: 'EXP',
        price: basePrice + 20000,
        estimatedDays: 1,
        estimatedMinHours: 12,
        estimatedMaxHours: 24,
        availableCod: true,
      },
      {
        courierName: 'HERONA',
        service: 'One Day',
        serviceCode: 'OND',
        price: basePrice + 35000,
        estimatedDays: 1,
        estimatedMinHours: 6,
        estimatedMaxHours: 12,
        availableCod: false,
      },
    ];
  }

  private getMockOrderResult(params: OrderParams): OrderResult {
    const trackingNumber = `HRN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      orderId: `HRN_${params.subOrderId}`,
      trackingNumber,
      price: 20000,
      estimatedPickupTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      estimatedDeliveryTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      awbUrl: `https://track.herona.co.id/${trackingNumber}`,
      labelUrl: `https://label.herona.co.id/${trackingNumber}`,
    };
  }

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
    };
  }

  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Pesanan diterima, menunggu proses Herona',
      picked_up: 'Paket telah diambil oleh kurir Herona',
      in_transit: 'Paket sedang dalam perjalanan menuju tujuan',
      delivered: 'Paket telah sampai ke tujuan',
    };
    return descriptions[status] || 'Status tidak diketahui';
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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
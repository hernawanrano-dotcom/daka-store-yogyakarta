// apps/backend/src/modules/courier/adapters/daka-instant.adapter.ts

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
export class DakaInstantAdapter implements CourierAdapter {
  private readonly logger = new Logger(DakaInstantAdapter.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isProduction: boolean;

  constructor() {
    this.apiKey = process.env.DAKA_INSTANT_API_KEY || '';
    this.baseUrl = process.env.DAKA_INSTANT_BASE_URL || 'https://api.daka.com/instant';
    this.isProduction = process.env.DAKA_INSTANT_IS_PRODUCTION === 'true';

    if (!this.apiKey && !this.isProduction) {
      this.logger.warn('DAKA_INSTANT_API_KEY not set, using mock mode for development');
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
        this.logger.error(`Daka Instant API Error: ${error.message}`, error.response?.data);
        throw error;
      }
    );
  }

  getName(): string {
    return 'DAKA_INSTANT';
  }

  supportsWebhook(): boolean {
    return true;
  }

  supportsPolling(): boolean {
    return true;
  }

  async getRates(params: RateParams): Promise<Rate[]> {
    this.logger.log(`Getting Daka Instant rates for weight: ${params.weightGram}g`);

    if (!this.apiKey) {
      return this.getMockRates(params);
    }

    try {
      const response = await this.client.post('/v1/rates', {
        origin: { lat: params.originLat, lng: params.originLng },
        destination: { lat: params.destLat, lng: params.destLng },
        weight: params.weightGram,
      });

      return this.mapRatesResponse(response.data);
    } catch (error) {
      this.logger.error(`Failed to get Daka Instant rates: ${error.message}`);
      return this.getMockRates(params);
    }
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating Daka Instant order for subOrderId: ${params.subOrderId}`);

    if (!this.apiKey) {
      return this.getMockOrderResult(params);
    }

    try {
      const totalWeight = params.items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0);

      const payload = {
        order_id: params.subOrderId,
        pickup: {
          name: params.fromAddress.name,
          phone: params.fromAddress.phone,
          address: params.fromAddress.address,
          lat: params.fromAddress.lat,
          lng: params.fromAddress.lng,
        },
        delivery: {
          name: params.toAddress.name,
          phone: params.toAddress.phone,
          address: params.toAddress.address,
          lat: params.toAddress.lat,
          lng: params.toAddress.lng,
        },
        items: params.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          weight: item.weightGram,
        })),
        total_weight: totalWeight,
        payment_method: params.paymentMethod,
        cod_amount: params.codAmount,
        notes: params.notes,
        service_type: 'instant',
        is_cod: params.paymentMethod === 'cod',
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
        waybillId: response.data.waybill_id,
      };
    } catch (error) {
      this.logger.error(`Failed to create Daka Instant order: ${error.message}`);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking Daka Instant order: ${trackingNumber}`);

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
      this.logger.error(`Failed to track Daka Instant order: ${error.message}`);
      return this.getMockTrackingStatus(trackingNumber);
    }
  }

  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<void> {
    this.logger.log(`Handling Daka Instant webhook`);

    if (!this.verifySignature(payload, headers)) {
      throw new Error('Invalid webhook signature');
    }

    this.logger.debug(`Daka Instant webhook received: ${JSON.stringify(payload)}`);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    this.logger.log(`Cancelling Daka Instant order: ${orderId}`);

    if (!this.apiKey) {
      return true;
    }

    try {
      await this.client.post(`/v1/orders/${orderId}/cancel`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel Daka Instant order: ${error.message}`);
      return false;
    }
  }

  private verifySignature(payload: any, headers?: Record<string, string>): boolean {
    return true;
  }

  private mapStatus(
    status: string
  ): 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' {
    const map: Record<string, any> = {
      CREATED: 'pending',
      ASSIGNED: 'pending',
      PICKED_UP: 'picked_up',
      ON_DELIVERY: 'in_transit',
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
      courierName: 'DAKA_INSTANT',
      service: service.name,
      serviceCode: service.code,
      price: Math.round(service.price),
      estimatedDays: 0,
      estimatedMinHours: service.min_hours || 1,
      estimatedMaxHours: service.max_hours || 2,
      availableCod: service.cod_available || true,
    }));
  }

  private getMockRates(params: RateParams): Rate[] {
    const distance = this.calculateDistance(
      params.originLat || -7.7956,
      params.originLng || 110.3695,
      params.destLat || -7.7956,
      params.destLng || 110.3695
    );
    const basePrice =
      20000 + Math.floor(distance * 5000) + Math.floor((params.weightGram || 1000) / 1000) * 5000;

    return [
      {
        courierName: 'DAKA_INSTANT',
        service: 'Instant Delivery',
        serviceCode: 'ID',
        price: basePrice,
        estimatedDays: 0,
        estimatedMinHours: 1,
        estimatedMaxHours: 2,
        availableCod: true,
      },
      {
        courierName: 'DAKA_INSTANT',
        service: 'Super Instant',
        serviceCode: 'SI',
        price: basePrice + 30000,
        estimatedDays: 0,
        estimatedMinHours: 0.5,
        estimatedMaxHours: 1,
        availableCod: false,
      },
    ];
  }

  private getMockOrderResult(params: OrderParams): OrderResult {
    const trackingNumber = `DKI${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      orderId: `DKA_IN_${params.subOrderId}`,
      trackingNumber,
      price: 35000,
      estimatedPickupTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      estimatedDeliveryTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      awbUrl: `https://track.daka.com/instant/${trackingNumber}`,
      labelUrl: `https://label.daka.com/instant/${trackingNumber}`,
    };
  }

  private getMockTrackingStatus(trackingNumber: string): TrackingStatus {
    const randomStatus = Math.random();
    let status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' = 'pending';

    if (randomStatus < 0.2) status = 'pending';
    else if (randomStatus < 0.5) status = 'picked_up';
    else if (randomStatus < 0.8) status = 'in_transit';
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
      pending: 'Pesanan diterima, mencari kurir terdekat',
      picked_up: 'Kurir telah mengambil paket (instant delivery)',
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
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

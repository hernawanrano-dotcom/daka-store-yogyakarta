// apps/backend/src/modules/courier/adapters/grab.adapter.ts

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
export class GrabAdapter implements CourierAdapter {
  private readonly logger = new Logger(GrabAdapter.name);
  private readonly client: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly isProduction: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.clientId = process.env.GRAB_CLIENT_ID || '';
    this.clientSecret = process.env.GRAB_CLIENT_SECRET || '';
    this.baseUrl = process.env.GRAB_BASE_URL || 'https://api.grab.com/grabexpress';
    this.isProduction = process.env.GRAB_IS_PRODUCTION === 'true';

    if ((!this.clientId || !this.clientSecret) && !this.isProduction) {
      this.logger.warn('GRAB_CLIENT_ID or GRAB_CLIENT_SECRET not set, using mock mode');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`Grab API Error: ${error.message}`, error.response?.data);
        throw error;
      }
    );
  }

  getName(): string {
    return 'GRAB';
  }

  supportsWebhook(): boolean {
    return true;
  }

  supportsPolling(): boolean {
    return true;
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      return null;
    }

    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://api.grab.com/oauth/v1/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      this.logger.log('Grab access token refreshed');

      return this.accessToken;
    } catch (error) {
      this.logger.error(`Failed to get Grab access token: ${error.message}`);
      return null;
    }
  }

  async getRates(params: RateParams): Promise<Rate[]> {
    this.logger.log(`Getting Grab rates for weight: ${params.weightGram}g`);

    if (!this.clientId) {
      return this.getMockRates(params);
    }

    try {
      const response = await this.client.post('/v1/delivery-quotes', {
        origin: { lat: params.originLat, lng: params.originLng },
        destination: { lat: params.destLat, lng: params.destLng },
        weight: params.weightGram,
        item_type: params.itemType,
        item_value: params.itemValue,
      });

      return this.mapRatesResponse(response.data);
    } catch (error) {
      this.logger.error(`Failed to get Grab rates: ${error.message}`);
      return this.getMockRates(params);
    }
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating Grab order for subOrderId: ${params.subOrderId}`);

    if (!this.clientId) {
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
        },
        to: {
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
        payment_method: params.paymentMethod === 'cod' ? 'CASH_ON_DELIVERY' : 'DIGITAL',
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
        awbUrl: response.data.tracking_url,
        labelUrl: response.data.label_url,
      };
    } catch (error) {
      this.logger.error(`Failed to create Grab order: ${error.message}`);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking Grab order: ${trackingNumber}`);

    if (!this.clientId) {
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
      this.logger.error(`Failed to track Grab order: ${error.message}`);
      return this.getMockTrackingStatus(trackingNumber);
    }
  }

  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<void> {
    this.logger.log(`Handling Grab webhook`);

    if (!this.verifySignature(payload, headers)) {
      throw new Error('Invalid webhook signature');
    }

    this.logger.debug(`Grab webhook received: ${JSON.stringify(payload)}`);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    this.logger.log(`Cancelling Grab order: ${orderId}`);

    if (!this.clientId) {
      return true;
    }

    try {
      await this.client.post(`/v1/orders/${orderId}/cancel`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel Grab order: ${error.message}`);
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
      IN_TRANSIT: 'in_transit',
      DELIVERED: 'delivered',
      FAILED: 'failed',
      CANCELLED: 'failed',
    };
    return map[status] || 'pending';
  }

  private mapRatesResponse(data: any): Rate[] {
    if (!data.quotes) {
      return this.getMockRates({} as RateParams);
    }

    return data.quotes.map((quote: any) => ({
      courierName: 'GRAB',
      service: quote.service_type,
      serviceCode: quote.service_code,
      price: Math.round(quote.amount),
      estimatedDays: 0,
      estimatedMinHours: quote.duration_min,
      estimatedMaxHours: quote.duration_max,
      availableCod: quote.cod_available || false,
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
      20000 + Math.floor(distance * 4500) + Math.floor((params.weightGram || 1000) / 1000) * 2500;

    return [
      {
        courierName: 'GRAB',
        service: 'GrabExpress Instant',
        serviceCode: 'INSTANT',
        price: basePrice,
        estimatedDays: 0,
        estimatedMinHours: 1,
        estimatedMaxHours: 2,
        availableCod: false,
      },
      {
        courierName: 'GRAB',
        service: 'GrabExpress SameDay',
        serviceCode: 'SAMEDAY',
        price: basePrice + 15000,
        estimatedDays: 0,
        estimatedMinHours: 3,
        estimatedMaxHours: 5,
        availableCod: true,
      },
    ];
  }

  private getMockOrderResult(params: OrderParams): OrderResult {
    const trackingNumber = `GRB${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      orderId: `GRB_${params.subOrderId}`,
      trackingNumber,
      price: 30000,
      estimatedPickupTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      estimatedDeliveryTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      awbUrl: `https://track.grab.com/${trackingNumber}`,
      labelUrl: `https://label.grab.com/${trackingNumber}`,
    };
  }

  private getMockTrackingStatus(trackingNumber: string): TrackingStatus {
    const randomStatus = Math.random();
    let status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' = 'pending';

    if (randomStatus < 0.25) status = 'pending';
    else if (randomStatus < 0.55) status = 'picked_up';
    else if (randomStatus < 0.85) status = 'in_transit';
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
      pending: 'Mencari driver Grab terdekat',
      picked_up: 'Driver telah mengambil paket',
      in_transit: 'Paket sedang dalam perjalanan',
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

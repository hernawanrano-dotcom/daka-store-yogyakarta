// apps/backend/src/modules/courier/adapters/pos.adapter.ts

/**
 * POS INDONESIA ADAPTER
 * 
 * CATATAN PENTING:
 * - POS Indonesia menggunakan protokol SOAP (bukan REST)
 * - Tidak memiliki webhook → WAJIB polling fallback
 * - Implementasi ini menggunakan axios dengan XML parsing
 * - Atau bisa menggunakan library 'soap' jika diperlukan
 * 
 * DOKUMENTASI:
 * - WSDL: https://api.posindonesia.co.id/wsdl
 * - API Documentation: https://developer.posindonesia.co.id
 */

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

// Untuk SOAP, kita perlu build XML request dan parse XML response
// Sementara ini menggunakan mock data untuk development
// Implementasi production akan menggunakan library 'soap'

@Injectable()
export class PosAdapter implements CourierAdapter {
  private readonly logger = new Logger(PosAdapter.name);
  private readonly client: AxiosInstance;
  private readonly username: string;
  private readonly password: string;
  private readonly baseUrl: string;
  private readonly isProduction: boolean;
  private sessionToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.username = process.env.POS_USERNAME || '';
    this.password = process.env.POS_PASSWORD || '';
    this.baseUrl = process.env.POS_BASE_URL || 'https://api.posindonesia.co.id';
    this.isProduction = process.env.POS_IS_PRODUCTION === 'true';

    if ((!this.username || !this.password) && !this.isProduction) {
      this.logger.warn('POS_USERNAME or POS_PASSWORD not set, using mock mode for development');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 45000, // SOAP biasanya lebih lambat
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`POS API Error: ${error.message}`, error.response?.data);
        throw error;
      },
    );
  }

  getName(): string {
    return 'POS';
  }

  /**
   * POS Indonesia TIDAK memiliki webhook
   * WAJIB menggunakan polling fallback
   */
  supportsWebhook(): boolean {
    return false;
  }

  /**
   * POS Indonesia support polling (wajib dijalankan setiap 5 menit)
   */
  supportsPolling(): boolean {
    return true;
  }

  /**
   * Login ke SOAP service untuk mendapatkan session token
   */
  private async login(): Promise<string | null> {
    if (!this.username || !this.password) {
      return null;
    }

    if (this.sessionToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.sessionToken;
    }

    try {
      // SOAP Login Request
      const soapRequest = this.buildLoginSoapRequest(this.username, this.password);
      
      const response = await this.client.post('/soap/login', soapRequest, {
        headers: { 'Content-Type': 'text/xml' },
      });

      // Parse SOAP response
      const token = this.parseLoginResponse(response.data);
      
      if (token) {
        this.sessionToken = token;
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 jam
        this.logger.log('POS Indonesia login successful');
      }

      return token;
    } catch (error) {
      this.logger.error(`POS login failed: ${error.message}`);
      return null;
    }
  }

  async getRates(params: RateParams): Promise<Rate[]> {
    this.logger.log(`Getting POS rates for weight: ${params.weightGram}g`);

    if (!this.username) {
      return this.getMockRates(params);
    }

    try {
      await this.login();
      
      // SOAP GetRates Request
      const soapRequest = this.buildGetRatesSoapRequest(params);
      
      const response = await this.client.post('/soap/rates', soapRequest, {
        headers: { 'Content-Type': 'text/xml' },
      });

      return this.parseRatesResponse(response.data, params);
    } catch (error) {
      this.logger.error(`Failed to get POS rates: ${error.message}`);
      return this.getMockRates(params);
    }
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    this.logger.log(`Creating POS order for subOrderId: ${params.subOrderId}`);

    if (!this.username) {
      return this.getMockOrderResult(params);
    }

    try {
      await this.login();

      const totalWeight = params.items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0);

      // SOAP CreateOrder Request
      const soapRequest = this.buildCreateOrderSoapRequest(params, totalWeight);
      
      const response = await this.client.post('/soap/orders', soapRequest, {
        headers: { 'Content-Type': 'text/xml' },
      });

      return this.parseOrderResponse(response.data, params);
    } catch (error) {
      this.logger.error(`Failed to create POS order: ${error.message}`);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string): Promise<TrackingStatus> {
    this.logger.log(`Tracking POS order: ${trackingNumber}`);

    if (!this.username) {
      return this.getMockTrackingStatus(trackingNumber);
    }

    try {
      await this.login();

      // SOAP Tracking Request
      const soapRequest = this.buildTrackingSoapRequest(trackingNumber);
      
      const response = await this.client.post('/soap/tracking', soapRequest, {
        headers: { 'Content-Type': 'text/xml' },
      });

      return this.parseTrackingResponse(response.data);
    } catch (error) {
      this.logger.error(`Failed to track POS order: ${error.message}`);
      return this.getMockTrackingStatus(trackingNumber);
    }
  }

  /**
   * POS Indonesia TIDAK memiliki webhook
   * Method ini tetap ada untuk memenuhi interface
   */
  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<void> {
    this.logger.warn('POS Indonesia does not support webhooks. Use polling instead.');
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    this.logger.log(`Cancelling POS order: ${orderId}`);

    if (!this.username) {
      return true;
    }

    try {
      await this.login();

      const soapRequest = this.buildCancelOrderSoapRequest(orderId);
      
      await this.client.post('/soap/orders/cancel', soapRequest, {
        headers: { 'Content-Type': 'text/xml' },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel POS order: ${error.message}`);
      return false;
    }
  }

  // ==================== SOAP Request Builders ====================

  private buildLoginSoapRequest(username: string, password: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://posindonesia.co.id/webservices">
  <soap:Header/>
  <soap:Body>
    <tns:login>
      <tns:username>${this.escapeXml(username)}</tns:username>
      <tns:password>${this.escapeXml(password)}</tns:password>
    </tns:login>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildGetRatesSoapRequest(params: RateParams): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://posindonesia.co.id/webservices">
  <soap:Header/>
  <soap:Body>
    <tns:getRates>
      <tns:originLat>${params.originLat}</tns:originLat>
      <tns:originLng>${params.originLng}</tns:originLng>
      <tns:destLat>${params.destLat}</tns:destLat>
      <tns:destLng>${params.destLng}</tns:destLng>
      <tns:weight>${params.weightGram}</tns:weight>
      <tns:itemType>${params.itemType}</tns:itemType>
    </tns:getRates>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildCreateOrderSoapRequest(params: OrderParams, totalWeight: number): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://posindonesia.co.id/webservices">
  <soap:Header/>
  <soap:Body>
    <tns:createOrder>
      <tns:orderId>${params.subOrderId}</tns:orderId>
      <tns:fromAddress>
        <tns:name>${this.escapeXml(params.fromAddress.name)}</tns:name>
        <tns:phone>${params.fromAddress.phone}</tns:phone>
        <tns:address>${this.escapeXml(params.fromAddress.address)}</tns:address>
        <tns:lat>${params.fromAddress.lat}</tns:lat>
        <tns:lng>${params.fromAddress.lng}</tns:lng>
      </tns:fromAddress>
      <tns:toAddress>
        <tns:name>${this.escapeXml(params.toAddress.name)}</tns:name>
        <tns:phone>${params.toAddress.phone}</tns:phone>
        <tns:address>${this.escapeXml(params.toAddress.address)}</tns:address>
        <tns:lat>${params.toAddress.lat}</tns:lat>
        <tns:lng>${params.toAddress.lng}</tns:lng>
      </tns:toAddress>
      <tns:totalWeight>${totalWeight}</tns:totalWeight>
      <tns:paymentMethod>${params.paymentMethod}</tns:paymentMethod>
      <tns:notes>${this.escapeXml(params.notes || '')}</tns:notes>
    </tns:createOrder>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildTrackingSoapRequest(trackingNumber: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://posindonesia.co.id/webservices">
  <soap:Header/>
  <soap:Body>
    <tns:trackOrder>
      <tns:trackingNumber>${trackingNumber}</tns:trackingNumber>
    </tns:trackOrder>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildCancelOrderSoapRequest(orderId: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://posindonesia.co.id/webservices">
  <soap:Header/>
  <soap:Body>
    <tns:cancelOrder>
      <tns:orderId>${orderId}</tns:orderId>
    </tns:cancelOrder>
  </soap:Body>
</soap:Envelope>`;
  }

  // ==================== SOAP Response Parsers ====================

  private parseLoginResponse(xmlData: string): string | null {
    // Parse XML response untuk mendapatkan token
    // Implementasi sederhana dengan regex (untuk production pakai xml2js)
    const tokenMatch = xmlData.match(/<tns:sessionToken>(.*?)<\/tns:sessionToken>/);
    return tokenMatch ? tokenMatch[1] : null;
  }

  private parseRatesResponse(xmlData: string, params: RateParams): Rate[] {
    // Parse XML response untuk mendapatkan rates
    // Untuk sementara return mock data
    return this.getMockRates(params);
  }

  private parseOrderResponse(xmlData: string, params: OrderParams): OrderResult {
    // Parse XML response untuk mendapatkan order result
    // Untuk sementara return mock data
    return this.getMockOrderResult(params);
  }

  private parseTrackingResponse(xmlData: string): TrackingStatus {
    // Parse XML response untuk mendapatkan tracking status
    // Untuk sementara return mock data
    const statusMatch = xmlData.match(/<tns:status>(.*?)<\/tns:status>/);
    const locationMatch = xmlData.match(/<tns:location>(.*?)<\/tns:location>/);
    
    return {
      status: this.mapPosStatus(statusMatch ? statusMatch[1] : 'PENDING'),
      location: locationMatch ? locationMatch[1] : '',
      timestamp: new Date().toISOString(),
      description: statusMatch ? `Status: ${statusMatch[1]}` : '',
      rawResponse: xmlData,
    };
  }

  // ==================== Helper Methods ====================

  private escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private mapPosStatus(status: string): 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' {
    const statusUpper = status.toUpperCase();
    const map: Record<string, any> = {
      'CREATED': 'pending',
      'RECEIVED': 'pending',
      'PROCESSING': 'pending',
      'PICKED_UP': 'picked_up',
      'IN_TRANSIT': 'in_transit',
      'ARRIVED': 'in_transit',
      'DELIVERED': 'delivered',
      'FAILED': 'failed',
      'RETURNED': 'returned',
      'CANCELLED': 'failed',
    };
    return map[statusUpper] || 'pending';
  }

  // ==================== Mock Data (Development) ====================

  private getMockRates(params: RateParams): Rate[] {
    const distance = this.calculateDistance(
      params.originLat || -7.7956,
      params.originLng || 110.3695,
      params.destLat || -7.7956,
      params.destLng || 110.3695,
    );
    const basePrice = 10000 + Math.floor(distance * 1500) + Math.floor((params.weightGram || 1000) / 1000) * 3000;

    return [
      {
        courierName: 'POS',
        service: 'POS Reguler',
        serviceCode: 'REG',
        price: basePrice,
        estimatedDays: 3,
        estimatedMinHours: 48,
        estimatedMaxHours: 72,
        availableCod: true,
        note: 'Estimasi 3-5 hari kerja',
      },
      {
        courierName: 'POS',
        service: 'POS Express',
        serviceCode: 'EXP',
        price: basePrice + 25000,
        estimatedDays: 2,
        estimatedMinHours: 24,
        estimatedMaxHours: 48,
        availableCod: true,
        note: 'Estimasi 2-3 hari kerja',
      },
      {
        courierName: 'POS',
        service: 'POS Kilat Khusus',
        serviceCode: 'KK',
        price: basePrice + 50000,
        estimatedDays: 1,
        estimatedMinHours: 12,
        estimatedMaxHours: 24,
        availableCod: false,
        note: 'Hanya untuk kota besar',
      },
      {
        courierName: 'POS',
        service: 'POS Next Day',
        serviceCode: 'ND',
        price: basePrice + 75000,
        estimatedDays: 1,
        estimatedMinHours: 6,
        estimatedMaxHours: 12,
        availableCod: false,
        note: 'Next day delivery untuk area terbatas',
      },
    ];
  }

  private getMockOrderResult(params: OrderParams): OrderResult {
    const trackingNumber = `POS${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      orderId: `POS_${params.subOrderId}`,
      trackingNumber,
      price: 25000,
      estimatedPickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      estimatedDeliveryTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      awbUrl: `https://tracking.posindonesia.co.id/${trackingNumber}`,
      labelUrl: `https://label.posindonesia.co.id/${trackingNumber}`,
      waybillId: trackingNumber,
    };
  }

  private getMockTrackingStatus(trackingNumber: string): TrackingStatus {
    const randomStatus = Math.random();
    let status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' = 'pending';

    if (randomStatus < 0.35) status = 'pending';
    else if (randomStatus < 0.6) status = 'picked_up';
    else if (randomStatus < 0.85) status = 'in_transit';
    else status = 'delivered';

    const statusDescriptions: Record<string, string> = {
      pending: 'Paket telah diterima oleh POS Indonesia, sedang diproses',
      picked_up: 'Paket telah diambil dan sedang dalam perjalanan ke pusat sortir',
      in_transit: 'Paket sedang dalam perjalanan menuju kota tujuan',
      delivered: 'Paket telah sampai ke tujuan dan diterima oleh penerima',
    };

    return {
      status,
      location: status === 'delivered' ? this.getRandomCity() : 'Jakarta',
      timestamp: new Date().toISOString(),
      description: statusDescriptions[status],
      rawResponse: { tracking_number: trackingNumber, status },
      courierStatus: status.toUpperCase(),
    };
  }

  private getRandomCity(): string {
    const cities = ['Yogyakarta', 'Jakarta', 'Surabaya', 'Bandung', 'Semarang', 'Medan'];
    return cities[Math.floor(Math.random() * cities.length)];
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
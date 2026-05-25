// apps/backend/src/modules/courier/courier.controller.ts

import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CourierService } from './courier.service';
import { CourierRegistry } from './courier.registry';
import { RateParams, OrderParams } from './interfaces/courier.adapter.interface';

@Controller('courier')
export class CourierController {
  constructor(
    private readonly courierService: CourierService,
    private readonly registry: CourierRegistry,
  ) {}

  /**
   * GET /api/v1/courier/rates
   * Hitung ongkir dari semua kurir atau kurir tertentu
   * Query params:
   * - originLat, originLng
   * - destLat, destLng
   * - weightGram
   * - itemType: 'document' | 'package'
   * - courierName? (opsional)
   */
  @Get('rates')
  async getRates(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
    @Query('weightGram') weightGram: string,
    @Query('itemType') itemType: 'document' | 'package',
    @Query('courierName') courierName?: string,
  ) {
    const params: RateParams = {
      originLat: parseFloat(originLat),
      originLng: parseFloat(originLng),
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
      weightGram: parseInt(weightGram),
      itemType: itemType || 'package',
    };

    const rates = await this.courierService.getRates(params, courierName);

    return {
      success: true,
      message: 'Rates retrieved successfully',
      data: rates,
    };
  }

  /**
   * POST /api/v1/courier/rates
   * Hitung ongkir (dengan body JSON)
   */
  @Post('rates')
  async getRatesPost(@Body() params: RateParams) {
    const rates = await this.courierService.getRates(params);

    return {
      success: true,
      message: 'Rates retrieved successfully',
      data: rates,
    };
  }

  /**
   * GET /api/v1/courier/available
   * Daftar kurir yang tersedia
   */
  @Get('available')
  async getAvailableCouriers() {
    const couriers = this.registry.getAvailableCouriers();

    return {
      success: true,
      message: 'Available couriers retrieved',
      data: couriers.map(name => ({
        name,
        supportsWebhook: this.registry.supportsWebhook(name),
        supportsPolling: this.registry.supportsPolling(name),
      })),
    };
  }

  /**
   * POST /api/v1/courier/order
   * Buat pesanan antar
   */
  @Post('order')
  async createOrder(@Body() params: OrderParams) {
    const result = await this.courierService.createShipment(params);

    return {
      success: true,
      message: 'Shipment order created successfully',
      data: result,
    };
  }

  /**
   * GET /api/v1/courier/tracking/:trackingNumber
   * Lacak pesanan
   */
  @Get('tracking/:trackingNumber')
  async trackOrder(@Param('trackingNumber') trackingNumber: string) {
    const status = await this.courierService.trackShipment(trackingNumber);

    return {
      success: true,
      message: 'Tracking status retrieved',
      data: status,
    };
  }
}
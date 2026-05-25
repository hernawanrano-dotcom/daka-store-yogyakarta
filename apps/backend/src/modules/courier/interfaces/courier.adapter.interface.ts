// apps/backend/src/modules/courier/interfaces/courier.adapter.interface.ts

/**
 * Parameter untuk hitung ongkir
 */
export interface RateParams {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  weightGram: number;
  itemType: 'document' | 'package';
  itemValue?: number; // untuk asuransi
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

/**
 * Hasil hitung ongkir per service
 */
export interface Rate {
  courierName: string;
  service: string; // "SameDay", "Instant", "Reguler", "Express"
  serviceCode?: string; // kode internal kurir
  price: number; // dalam Rupiah (integer)
  estimatedDays: number;
  estimatedMinHours?: number;
  estimatedMaxHours?: number;
  availableCod: boolean;
  insuranceCoverage?: number;
  note?: string;
}

/**
 * Parameter untuk buat pesanan antar
 */
export interface OrderParams {
  subOrderId: string;
  fromAddress: {
    name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
    postalCode?: string;
  };
  toAddress: {
    name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
    postalCode?: string;
  };
  items: {
    name: string;
    quantity: number;
    weightGram: number;
    price: number;
  }[];
  paymentMethod: 'cod' | 'digital';
  codAmount?: number; // jika COD
  notes?: string;
}

/**
 * Hasil buat pesanan antar
 */
export interface OrderResult {
  orderId: string; // internal courier order id
  trackingNumber: string;
  price: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  awbUrl?: string;
  labelUrl?: string;
  waybillId?: string;
}

/**
 * Status tracking
 */
export interface TrackingStatus {
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned';
  location: string;
  timestamp: string;
  description: string;
  rawResponse?: any; // untuk debugging
  courierStatus?: string; // raw status dari kurir
}

/**
 * Courier Adapter Interface
 * Semua adapter kurir WAJIB implement interface ini
 */
export interface CourierAdapter {
  /**
   * Dapatkan nama kurir
   */
  getName(): string;

  /**
   * Hitung ongkir dari semua service yang tersedia
   */
  getRates(params: RateParams): Promise<Rate[]>;

  /**
   * Buat pesanan antar
   */
  createOrder(params: OrderParams): Promise<OrderResult>;

  /**
   * Lacak pesanan berdasarkan nomor resi
   */
  trackOrder(trackingNumber: string): Promise<TrackingStatus>;

  /**
   * Handle webhook callback dari kurir (opsional, kalau ada webhook)
   */
  handleWebhook?(payload: any, headers?: Record<string, string>): Promise<void>;

  /**
   * Cancel order (opsional, kalau support)
   */
  cancelOrder?(orderId: string): Promise<boolean>;

  /**
   * Cek apakah kurir support webhook
   */
  supportsWebhook(): boolean;

  /**
   * Cek apakah kurir support polling (fallback)
   */
  supportsPolling(): boolean;
}

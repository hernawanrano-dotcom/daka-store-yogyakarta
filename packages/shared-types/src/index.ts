// ==================== ENUMS ====================

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAID = 'PAID',
  READY_TO_SHIP = 'READY_TO_SHIP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_APPROVED = 'REFUND_APPROVED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  QRIS = 'QRIS',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_CARD = 'CREDIT_CARD',
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT',
  COD = 'COD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

export enum CourierName {
  GOJEK = 'GOJEK',
  GRAB = 'GRAB',
  JNT = 'JNT',
  DAKA_SAMEDAY = 'DAKA_SAMEDAY',
  DAKA_INSTANT = 'DAKA_INSTANT',
  HERONA = 'HERONA',
  POS = 'POS',
}

export enum TrackingStatus {
  PENDING = 'PENDING',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED',
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_BUYER_WIN = 'RESOLVED_BUYER_WIN',
  RESOLVED_SELLER_WIN = 'RESOLVED_SELLER_WIN',
  CLOSED = 'CLOSED',
}

export enum DisputeReason {
  ITEM_NOT_RECEIVED = 'ITEM_NOT_RECEIVED',
  ITEM_NOT_AS_DESCRIBED = 'ITEM_NOT_AS_DESCRIBED',
  DAMAGED_ITEM = 'DAMAGED_ITEM',
  COUNTERFEIT = 'COUNTERFEIT',
  OTHER = 'OTHER',
}

export enum NotificationType {
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  SHIPPING = 'SHIPPING',
  PROMO = 'PROMO',
  SYSTEM = 'SYSTEM',
  CHAT = 'CHAT',
}

export enum VoucherType {
  MARKETPLACE = 'MARKETPLACE',
  SELLER = 'SELLER',
}

export enum VoucherDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum TransactionReferenceType {
  ORDER = 'ORDER',
  WITHDRAW = 'WITHDRAW',
  REFUND = 'REFUND',
  PLATFORM_FEE = 'PLATFORM_FEE',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
}

// ==================== USER TYPES ====================

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== PRODUCT TYPES ====================

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  weightGram: number;
  categoryId?: string;
  isActive: boolean;
  isFeatured: boolean;
  viewsCount: number;
  soldCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  priceAdjust: number;
  stock: number;
  image?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  error: {
    code: string;
    details?: any;
  };
}

// ==================== DTO TYPES ====================

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface CreateAddressDTO {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}
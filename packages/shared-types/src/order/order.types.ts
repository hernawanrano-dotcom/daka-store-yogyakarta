export enum OrderStatusEnum {
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

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image: string;
  stock: number;
}

export interface Cart {
  items: CartItem[];
  totalPrice: number;
}

export interface CheckoutResponse {
  orderId: string;
  grandTotal: number;
  expiresAt: Date;
}

export interface Order {
  id: string;
  buyerId: string;
  grandTotal: number;
  status: OrderStatusEnum;
  createdAt: Date;
  expiresAt: Date;
  paidAt?: Date;
  completedAt?: Date;
  subOrders: SubOrder[];
}

export interface SubOrder {
  id: string;
  masterOrderId: string;
  sellerId: string;
  sellerName: string;
  trackingNumber?: string;
  courierName?: string;
  shippingFee: number;
  grandTotal: number;
  status: OrderStatusEnum;
  items: OrderItem[];
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  image: string;
}
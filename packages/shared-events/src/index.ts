// Event names
export const OrderEvents = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_PAID: 'ORDER_PAID',
  ORDER_PROCESSING: 'ORDER_PROCESSING',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_REFUND_REQUESTED: 'ORDER_REFUND_REQUESTED',
} as const;

export const PaymentEvents = {
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
} as const;

export const CourierEvents = {
  COURIER_ORDER_CREATED: 'COURIER_ORDER_CREATED',
  TRACKING_UPDATED: 'TRACKING_UPDATED',
  COURIER_PICKED_UP: 'COURIER_PICKED_UP',
  COURIER_DELIVERED: 'COURIER_DELIVERED',
  COURIER_FAILED: 'COURIER_FAILED',
} as const;

export const UserEvents = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_SWITCH_ROLE: 'USER_SWITCH_ROLE',
  USER_BLOCKED: 'USER_BLOCKED',
  USER_EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
} as const;

export const ProductEvents = {
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  PRODUCT_PRICE_CHANGED: 'PRODUCT_PRICE_CHANGED',
  PRODUCT_STOCK_CHANGED: 'PRODUCT_STOCK_CHANGED',
  REVIEW_CREATED: 'REVIEW_CREATED',
} as const;

export const LedgerEvents = {
  WALLET_CREATED: 'WALLET_CREATED',
  WALLET_CREDITED: 'WALLET_CREDITED',
  WALLET_DEBITED: 'WALLET_DEBITED',
  ESCROW_CREATED: 'ESCROW_CREATED',
  ESCROW_RELEASED: 'ESCROW_RELEASED',
  WITHDRAW_REQUESTED: 'WITHDRAW_REQUESTED',
  WITHDRAW_COMPLETED: 'WITHDRAW_COMPLETED',
} as const;

export const EngagementEvents = {
  FLASH_SALE_STARTED: 'FLASH_SALE_STARTED',
  FLASH_SALE_ENDED: 'FLASH_SALE_ENDED',
  NEW_CHAT_MESSAGE: 'NEW_CHAT_MESSAGE',
  DISPUTE_CREATED: 'DISPUTE_CREATED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
} as const;

// Event payload types
export interface OrderCreatedPayload {
  orderId: string;
  buyerId: string;
  totalAmount: number;
  subOrders: Array<{
    sellerId: string;
    amount: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }>;
  createdAt: string;
}

export interface PaymentSuccessPayload {
  paymentId: string;
  orderId: string;
  amount: number;
  paidAt: string;
  midtransId: string;
}

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  registeredAt: string;
}

export interface TrackingUpdatedPayload {
  shipmentId: string;
  orderId: string;
  status: string;
  location: string;
  description: string;
  timestamp: string;
}

// Type helpers
export type AllEvents = 
  | typeof OrderEvents[keyof typeof OrderEvents]
  | typeof PaymentEvents[keyof typeof PaymentEvents]
  | typeof CourierEvents[keyof typeof CourierEvents]
  | typeof UserEvents[keyof typeof UserEvents]
  | typeof ProductEvents[keyof typeof ProductEvents]
  | typeof LedgerEvents[keyof typeof LedgerEvents]
  | typeof EngagementEvents[keyof typeof EngagementEvents];
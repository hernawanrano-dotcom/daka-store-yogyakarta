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

export type OrderEventType = typeof OrderEvents[keyof typeof OrderEvents];

export interface OrderCreatedPayload {
  orderId: string;
  buyerId: string;
  totalAmount: number;
  subOrders: {
    sellerId: string;
    amount: number;
    items: {
      productId: string;
      quantity: number;
      price: number;
    }[];
  }[];
  createdAt: string;
}

export interface OrderPaidPayload {
  orderId: string;
  paymentId: string;
  paidAmount: number;
  paidAt: string;
}

export interface OrderShippedPayload {
  orderId: string;
  subOrderId: string;
  trackingNumber: string;
  courierName: string;
  shippedAt: string;
}

export interface OrderDeliveredPayload {
  orderId: string;
  subOrderId: string;
  deliveredAt: string;
}

export interface OrderCompletedPayload {
  orderId: string;
  completedAt: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  reason: string;
  cancelledAt: string;
}

export interface OrderRefundRequestedPayload {
  orderId: string;
  subOrderId: string;
  reason: string;
  amount: number;
  requestedAt: string;
}
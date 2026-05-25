export interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  token: string;
  expiredAt: Date;
}

export interface PaymentWebhookResult {
  success: boolean;
  orderId: string;
  status: 'settlement' | 'pending' | 'expire' | 'cancel' | 'deny';
  paymentType?: string;
  transactionId?: string;
  amount?: number;
  paidAt?: Date;
}
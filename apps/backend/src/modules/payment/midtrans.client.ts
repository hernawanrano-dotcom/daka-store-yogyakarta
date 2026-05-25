import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MidtransClient {
  private readonly logger = new Logger(MidtransClient.name);
  private readonly serverKey: string;

  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  }

  async createTransaction(data: { orderId: string; amount: number; buyerEmail: string }) {
    // Minimal stub implementation for build/tests — replace with real Midtrans SDK calls
    const transactionId = `midtrans_${Date.now()}`;
    const redirectUrl = `https://app.midtrans.com/redirect/${transactionId}`;
    const token = `token_${Math.random().toString(36).slice(2)}`;

    return {
      transactionId,
      redirectUrl,
      token,
      raw: data,
    };
  }

  verifySignature(payload: any, signature: string): boolean {
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + this.serverKey)
      .digest('hex');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      this.logger.warn(`Invalid signature for order ${orderId}. Expected: ${expectedSignature}, Got: ${signature}`);
    }

    return isValid;
  }
}

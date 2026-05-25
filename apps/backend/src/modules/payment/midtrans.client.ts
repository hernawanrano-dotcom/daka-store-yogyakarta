// REPLACE method verifySignature dengan ini:

  verifySignature(payload: any, signature: string): boolean {
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;
    const serverKey = this.serverKey;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex');

    const isValid = signature === expectedSignature;
    
    if (!isValid) {
      this.logger.warn(`Invalid signature for order ${orderId}. Expected: ${expectedSignature}, Got: ${signature}`);
    }
    
    return isValid;
  }
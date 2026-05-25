// REPLACE handleMidtransWebhook method dengan ini:

  @Post('webhook/midtrans')
  @HttpCode(HttpStatus.OK)
  async handleMidtransWebhook(@Req() req: Request, @Body() body: any): Promise<any> {
    const signature = req.headers['x-midtrans-signature'] as string;
    
    await this.paymentWebhookService.processWebhook(body, signature);
    
    return { success: true, message: 'Webhook processed' };
  }

// Juga update constructor:
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentWebhookService: PaymentWebhookService,
  ) {}
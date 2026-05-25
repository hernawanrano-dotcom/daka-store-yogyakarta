import { Controller, Post, HttpCode, HttpStatus, Req, Body } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentWebhookService } from './payment-webhook.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentWebhookService: PaymentWebhookService,
  ) {}

  @Post('webhook/midtrans')
  @HttpCode(HttpStatus.OK)
  async handleMidtransWebhook(@Req() req: Request, @Body() body: any): Promise<any> {
    const signature = (req as any).headers['x-midtrans-signature'] as string;

    await this.paymentWebhookService.processWebhook(body, signature);

    return { success: true, message: 'Webhook processed' };
  }
}

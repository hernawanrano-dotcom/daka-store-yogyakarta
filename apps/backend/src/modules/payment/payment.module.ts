import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentStateMachine } from './payment.state-machine';
import { MidtransClient } from './midtrans.client';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PaymentStateMachine, MidtransClient, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}

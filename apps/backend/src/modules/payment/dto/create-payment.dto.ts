import { IsEnum, IsInt, IsString, Min, Max } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsInt()
  @Min(1000)
  @Max(100000000)
  amount: number;

  @IsString()
  buyerEmail: string;

  @IsString()
  buyerName?: string;
}
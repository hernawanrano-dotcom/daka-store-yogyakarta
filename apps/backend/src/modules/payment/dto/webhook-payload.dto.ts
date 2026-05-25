import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  order_id: string;

  @IsString()
  transaction_status: string;

  @IsString()
  fraud_status: string;

  @IsString()
  payment_type: string;

  @IsString()
  transaction_id: string;

  @IsNumberString()
  gross_amount: string;

  @IsString()
  @IsOptional()
  settlement_time?: string;

  @IsString()
  @IsOptional()
  status_code?: string;

  @IsString()
  @IsOptional()
  signature_key?: string;
}
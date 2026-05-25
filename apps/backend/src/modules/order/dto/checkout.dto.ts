import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CheckoutDto {
  @IsString()
  addressId: string;

  @IsString()
  courierName: string;

  @IsString()
  courierService: string;

  @IsString()
  @IsOptional()
  voucherCode?: string;
}

export class CancelOrderDto {
  @IsString()
  reason: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  courierName?: string;
}

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  quantity: number;
}
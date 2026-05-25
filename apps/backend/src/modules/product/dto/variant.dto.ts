import { IsString, IsInt, IsOptional, Min, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  name: string;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  priceAdjust: number;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  stock: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  image?: string;
}

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @IsOptional()
  priceAdjust?: number;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  image?: string;
}

export class VariantQueryDto {
  @IsUUID()
  productId: string;
}

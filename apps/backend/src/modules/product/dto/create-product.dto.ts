import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
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
  image?: string;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  price: number;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  stock: number;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  weightGram: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

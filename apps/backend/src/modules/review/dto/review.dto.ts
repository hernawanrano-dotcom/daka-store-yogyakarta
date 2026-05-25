import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateReviewDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  productId: string;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsOptional()
  images?: string[]; // base64 encoded images
}

export class UpdateReviewDto {
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class ReplyReviewDto {
  @IsString()
  reply: string;
}

export class ReviewQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsBoolean()
  @IsOptional()
  withImages?: boolean;

  @IsString()
  @IsOptional()
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}
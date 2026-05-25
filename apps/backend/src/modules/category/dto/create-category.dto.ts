import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  @IsOptional()
  level?: number;

  @Transform(({ value }) => parseInt(value) || 0)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

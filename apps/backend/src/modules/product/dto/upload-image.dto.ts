import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadImageDto {
  @IsString()
  image: string; // base64 encoded image

  @IsString()
  @IsOptional()
  filename?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class ReorderImageDto {
  @IsString()
  imageId: string;

  @Transform(({ value }) => parseInt(value) || 0)
  sortOrder: number;
}

export class SetPrimaryImageDto {
  @IsString()
  imageId: string;
}

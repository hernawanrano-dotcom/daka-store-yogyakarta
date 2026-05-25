import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddressDto {
  @IsString()
  label: string;

  @IsString()
  recipientName: string;

  @IsString()
  phone: string;

  @IsString()
  addressLine: string;

  @IsString()
  subdistrict: string;

  @IsString()
  district: string;

  @IsString()
  city: string;

  @IsString()
  province: string;

  @IsString()
  postalCode: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
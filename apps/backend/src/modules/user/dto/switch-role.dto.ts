import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class SwitchRoleDto {
  @IsEnum(['buyer', 'seller'])
  role: 'buyer' | 'seller';
}
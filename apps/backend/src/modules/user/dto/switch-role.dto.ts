import { IsEnum } from 'class-validator';
import { UserRole } from '@daka/shared-types';

export class SwitchRoleDto {
  @IsEnum(['buyer', 'seller'])
  role: 'buyer' | 'seller';
}

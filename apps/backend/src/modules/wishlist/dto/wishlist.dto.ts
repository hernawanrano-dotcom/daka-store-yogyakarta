import { IsString, IsUUID } from 'class-validator';

export class AddToWishlistDto {
  @IsUUID()
  productId: string;
}

export class WishlistQueryDto {
  @IsString()
  @IsUUID()
  userId: string;
}

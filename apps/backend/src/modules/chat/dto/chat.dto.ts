import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  toUserId: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  message?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;
}

export class JoinRoomDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  sellerId: string;

  @IsUUID()
  buyerId: string;
}

export class TypingDto {
  @IsUUID()
  toUserId: string;

  isTyping: boolean;
}

export class MarkReadDto {
  @IsUUID()
  fromUserId: string;
}

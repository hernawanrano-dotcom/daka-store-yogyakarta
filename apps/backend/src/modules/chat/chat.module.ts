import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventBusService } from '../../common/event-bus/event-bus.service';

@Module({
  imports: [PrismaModule],
  providers: [ChatGateway, ChatService, EventBusService],
  exports: [ChatService],
})
export class ChatModule {}

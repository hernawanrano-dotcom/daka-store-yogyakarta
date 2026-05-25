import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { JwtService } from '@nestjs/jwt';
import { EngagementEvents } from '@daka/shared-events';

interface ChatMessage {
  toUserId: string;
  message: string;
  imageUrl?: string;
  orderId?: string;
}

interface TypingEvent {
  toUserId: string;
  isTyping: boolean;
}

@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: 'chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private eventBus: EventBusService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId = payload.sub;
      client.data.userId = userId;

      // Store socket connection
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId).push(client.id);

      // Join user to their personal room
      client.join(`user:${userId}`);

      this.logger.log(`Client ${client.id} connected as user ${userId}`);

      // Send unread messages count
      const unreadCount = await this.chatService.getUnreadCount(userId);
      client.emit('unread_count', { count: unreadCount });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId && this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId).filter((id) => id !== client.id);
      if (sockets.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, sockets);
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; sellerId: string; buyerId: string }
  ) {
    const userId = client.data.userId;
    const roomName = `order:${data.orderId}`;

    // Verify user is either buyer or seller
    if (userId === data.buyerId || userId === data.sellerId) {
      client.join(roomName);
      client.data.currentRoom = roomName;
      this.logger.log(`User ${userId} joined room ${roomName}`);

      // Load previous messages
      const messages = await this.chatService.getConversation(
        data.orderId,
        data.buyerId,
        data.sellerId
      );

      client.emit('messages_history', messages);
    } else {
      client.emit('error', { message: 'Unauthorized to join this room' });
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    if (client.data.currentRoom) {
      client.leave(client.data.currentRoom);
      this.logger.log(`User ${client.data.userId} left room ${client.data.currentRoom}`);
      delete client.data.currentRoom;
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() data: ChatMessage) {
    const fromUserId = client.data.userId;
    const { toUserId, message, imageUrl, orderId } = data;

    if (!message && !imageUrl) {
      client.emit('error', { message: 'Message or image required' });
      return;
    }

    try {
      // Save message to database
      const savedMessage = await this.chatService.saveMessage({
        fromUserId,
        toUserId,
        message,
        imageUrl,
        orderId,
      });

      // Emit to recipient's personal room
      this.server.to(`user:${toUserId}`).emit('receive_message', {
        id: savedMessage.id,
        fromUserId,
        message,
        imageUrl,
        createdAt: savedMessage.createdAt,
      });

      // Also emit to order room if exists
      if (orderId) {
        this.server.to(`order:${orderId}`).emit('receive_message', {
          id: savedMessage.id,
          fromUserId,
          message,
          imageUrl,
          createdAt: savedMessage.createdAt,
        });
      }

      // Publish NEW_CHAT_MESSAGE event
      await this.eventBus.publishOutbox(EngagementEvents.NEW_CHAT_MESSAGE, {
        messageId: savedMessage.id,
        fromUserId,
        toUserId,
        orderId,
        message,
        imageUrl,
        createdAt: savedMessage.createdAt.toISOString(),
      });

      // Acknowledge to sender
      client.emit('message_sent', {
        id: savedMessage.id,
        createdAt: savedMessage.createdAt,
      });

      this.logger.log(`Message sent from ${fromUserId} to ${toUserId}`);
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: TypingEvent) {
    const fromUserId = client.data.userId;
    const { toUserId, isTyping } = data;

    this.server.to(`user:${toUserId}`).emit('user_typing', {
      fromUserId,
      isTyping,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fromUserId: string }
  ) {
    const userId = client.data.userId;
    const { fromUserId } = data;

    await this.chatService.markMessagesAsRead(userId, fromUserId);

    // Notify sender that messages are read
    this.server.to(`user:${fromUserId}`).emit('messages_read', {
      byUserId: userId,
    });
  }

  // Helper method to send notification to specific user (called from other services)
  async sendNotificationToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}

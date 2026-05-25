import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SaveMessageDTO {
  fromUserId: string;
  toUserId: string;
  message?: string;
  imageUrl?: string;
  orderId?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async saveMessage(data: SaveMessageDTO) {
    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          message: data.message,
          imageUrl: data.imageUrl,
          orderId: data.orderId,
          isRead: false,
        },
      });

      return message;
    } catch (error) {
      this.logger.error(`Failed to save message: ${error.message}`);
      throw error;
    }
  }

  async getConversation(
    orderId: string,
    buyerId: string,
    sellerId: string,
    limit = 50,
    before?: Date
  ) {
    const where: any = {
      orderId,
      OR: [
        { fromUserId: buyerId, toUserId: sellerId },
        { fromUserId: sellerId, toUserId: buyerId },
      ],
    };

    if (before) {
      where.createdAt = { lt: before };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse(); // Return in chronological order
  }

  async getUserConversations(userId: string) {
    // Get unique chat partners
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const conversations = new Map();

    for (const msg of messages) {
      const partnerId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;

      if (!conversations.has(partnerId)) {
        // Get partner details
        const partner = await this.prisma.user.findUnique({
          where: { id: partnerId },
          select: { id: true, fullName: true, avatar: true },
        });

        // Count unread messages
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            fromUserId: partnerId,
            toUserId: userId,
            isRead: false,
          },
        });

        conversations.set(partnerId, {
          partner,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
          unreadCount,
        });
      }
    }

    return Array.from(conversations.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  async markMessagesAsRead(userId: string, fromUserId: string) {
    const result = await this.prisma.chatMessage.updateMany({
      where: {
        fromUserId,
        toUserId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.log(`Marked ${result.count} messages as read from ${fromUserId} to ${userId}`);
    return result.count;
  }

  async getUnreadCount(userId: string) {
    return this.prisma.chatMessage.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });
  }
}

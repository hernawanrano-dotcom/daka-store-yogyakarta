import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { EmailService } from './email.service';

export interface CreateNotificationDTO {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
}

export interface SendEmailDTO {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @InjectQueue('notification.email') private emailQueue: Queue,
    @InjectQueue('notification.push') private pushQueue: Queue,
  ) {}

  async create(createDto: CreateNotificationDTO) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: createDto.userId,
          type: createDto.type,
          title: createDto.title,
          body: createDto.body,
          data: createDto.data || {},
          isRead: false,
        },
      });

      // Add to push queue for real-time delivery
      await this.pushQueue.add('send-push', {
        userId: createDto.userId,
        notificationId: notification.id,
        title: createDto.title,
        body: createDto.body,
        data: createDto.data,
      });

      this.logger.log(`Notification created for user ${createDto.userId}: ${createDto.title}`);
      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  async getUserNotifications(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async sendOrderCreatedNotification(orderId: string, buyerId: string, sellerId: string) {
    // Notify seller
    await this.create({
      userId: sellerId,
      type: NotificationType.ORDER,
      title: 'Pesanan Baru!',
      body: `Anda mendapatkan pesanan baru #${orderId}. Segera proses pesanan.`,
      data: { orderId, type: 'order_created' },
    });

    // Send email to seller
    const seller = await this.prisma.user.findUnique({ where: { id: sellerId } });
    if (seller?.email) {
      await this.emailService.sendOrderNotificationEmail(seller.email, orderId, 'seller');
    }
  }

  async sendPaymentSuccessNotification(orderId: string, buyerId: string, amount: number) {
    // Notify buyer
    await this.create({
      userId: buyerId,
      type: NotificationType.PAYMENT,
      title: 'Pembayaran Berhasil',
      body: `Pembayaran pesanan #${orderId} sebesar Rp${amount.toLocaleString()} telah berhasil.`,
      data: { orderId, amount, type: 'payment_success' },
    });
  }

  async sendOrderShippedNotification(orderId: string, trackingNumber: string, buyerId: string) {
    // Notify buyer
    await this.create({
      userId: buyerId,
      type: NotificationType.SHIPPING,
      title: 'Pesanan Dikirim!',
      body: `Pesanan #${orderId} sedang dalam perjalanan. No Resi: ${trackingNumber}`,
      data: { orderId, trackingNumber, type: 'order_shipped' },
    });
  }

  async sendOrderCompletedNotification(orderId: string, sellerId: string) {
    // Notify seller
    await this.create({
      userId: sellerId,
      type: NotificationType.ORDER,
      title: 'Pesanan Selesai',
      body: `Pesanan #${orderId} telah selesai. Dana akan segera masuk ke wallet Anda.`,
      data: { orderId, type: 'order_completed' },
    });
  }

  async sendWelcomeEmail(userId: string, email: string, name: string) {
    await this.emailService.sendWelcomeEmail(email, name);
    
    await this.create({
      userId,
      type: NotificationType.SYSTEM,
      title: 'Selamat Datang di Daka Store!',
      body: 'Terima kasih telah bergabung. Nikmati pengalaman berbelanja di Daka Store.',
      data: { type: 'welcome' },
    });
  }
}
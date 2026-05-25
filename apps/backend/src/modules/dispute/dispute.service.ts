import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DisputeStatus, DisputeReason } from '@prisma/client';

export interface CreateDisputeDTO {
  subOrderId: string;
  buyerId: string;
  sellerId: string;
  reason: DisputeReason;
  description: string;
  evidenceFiles?: Express.Multer.File[];
  proposedAmount?: number;
}

export interface ResolveDisputeDTO {
  disputeId: string;
  adminId: string;
  verdict: 'BUYER_WIN' | 'SELLER_WIN';
  notes: string;
}

export interface AddDisputeMessageDTO {
  disputeId: string;
  userId: string;
  message: string;
  imageFiles?: Express.Multer.File[];
}

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('dispute.resolve') private resolveQueue: Queue
  ) {}

  async createDispute(data: CreateDisputeDTO) {
    // Validate order exists and is eligible for dispute
    const subOrder = await this.prisma.subOrder.findUnique({
      where: { id: data.subOrderId },
      include: {
        masterOrder: true,
        items: true,
      },
    });

    if (!subOrder) {
      throw new NotFoundException('Order not found');
    }

    // Only DELIVERED orders can be disputed
    if (subOrder.status !== 'DELIVERED') {
      throw new BadRequestException('Only delivered orders can be disputed');
    }

    // Check if dispute already exists
    const existingDispute = await this.prisma.dispute.findFirst({
      where: { subOrderId: data.subOrderId },
    });

    if (existingDispute) {
      throw new BadRequestException('Dispute already exists for this order');
    }

    // Upload evidence files to Cloudinary
    const evidenceUrls: string[] = [];
    if (data.evidenceFiles && data.evidenceFiles.length > 0) {
      for (const file of data.evidenceFiles) {
        const uploadResult = await this.cloudinaryService.uploadImage(file, {
          folder: `disputes/${data.subOrderId}`,
          resourceType: 'image',
        });
        evidenceUrls.push(uploadResult.secure_url);
      }
    }

    // Create dispute
    const dispute = await this.prisma.dispute.create({
      data: {
        subOrderId: data.subOrderId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        reason: data.reason,
        description: data.description,
        evidenceUrls,
        proposedAmount: data.proposedAmount,
        status: 'OPEN',
      },
      include: {
        buyer: {
          select: { id: true, fullName: true, email: true },
        },
        seller: {
          select: { id: true, fullName: true, email: true },
        },
        subOrder: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    });

    // Update order status
    await this.prisma.subOrder.update({
      where: { id: data.subOrderId },
      data: { status: 'REFUND_REQUESTED' },
    });

    // Publish event
    this.eventEmitter.emit('DISPUTE_CREATED', {
      disputeId: dispute.id,
      orderId: data.subOrderId,
      buyerId: data.buyerId,
      sellerId: data.sellerId,
      reason: data.reason,
      amount: subOrder.grandTotal,
    });

    this.logger.log(`Dispute created: ${dispute.id} for order ${data.subOrderId}`);

    return dispute;
  }

  async getDispute(disputeId: string, userId: string, userRole: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        buyer: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
        seller: {
          select: { id: true, fullName: true, email: true, avatar: true },
        },
        subOrder: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, fullName: true, avatar: true, role: true },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Check authorization
    if (userRole !== 'admin' && dispute.buyerId !== userId && dispute.sellerId !== userId) {
      throw new ForbiddenException('You are not authorized to view this dispute');
    }

    return dispute;
  }

  async getUserDisputes(userId: string, role: 'buyer' | 'seller', page = 1, limit = 10) {
    const where = role === 'buyer' ? { buyerId: userId } : { sellerId: userId };

    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          buyer: {
            select: { id: true, fullName: true },
          },
          seller: {
            select: { id: true, fullName: true },
          },
          subOrder: {
            select: {
              id: true,
              grandTotal: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      data: disputes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addMessage(data: AddDisputeMessageDTO) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: data.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Check authorization
    if (data.userId !== dispute.buyerId && data.userId !== dispute.sellerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { role: true },
      });

      if (user?.role !== 'admin') {
        throw new ForbiddenException('You are not authorized to add message to this dispute');
      }
    }

    // Upload images to Cloudinary
    const imageUrls: string[] = [];
    if (data.imageFiles && data.imageFiles.length > 0) {
      for (const file of data.imageFiles) {
        const uploadResult = await this.cloudinaryService.uploadImage(file, {
          folder: `disputes/${dispute.subOrderId}/messages`,
          resourceType: 'image',
        });
        imageUrls.push(uploadResult.secure_url);
      }
    }

    const message = await this.prisma.disputeMessage.create({
      data: {
        disputeId: data.disputeId,
        userId: data.userId,
        message: data.message,
        imageUrls,
      },
      include: {
        user: {
          select: { id: true, fullName: true, avatar: true, role: true },
        },
      },
    });

    this.logger.log(`Message added to dispute ${data.disputeId} by user ${data.userId}`);

    return message;
  }

  async resolveDispute(data: ResolveDisputeDTO) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: data.disputeId },
      include: {
        subOrder: {
          include: {
            masterOrder: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new BadRequestException('Dispute already resolved');
    }

    const newStatus = data.verdict === 'BUYER_WIN' ? 'RESOLVED_BUYER_WIN' : 'RESOLVED_SELLER_WIN';

    // Update dispute
    const updatedDispute = await this.prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        status: newStatus,
        adminResolvedBy: data.adminId,
        adminNotes: data.notes,
        resolvedAt: new Date(),
      },
    });

    // Update order status based on verdict
    if (data.verdict === 'BUYER_WIN') {
      await this.prisma.subOrder.update({
        where: { id: dispute.subOrderId },
        data: { status: 'REFUND_APPROVED' },
      });

      // Trigger refund process via event
      this.eventEmitter.emit('DISPUTE_RESOLVED', {
        disputeId: dispute.id,
        orderId: dispute.subOrderId,
        winner: 'BUYER',
        resolution: 'REFUND',
        amount: dispute.proposedAmount || dispute.subOrder.grandTotal,
      });
    } else {
      await this.prisma.subOrder.update({
        where: { id: dispute.subOrderId },
        data: { status: 'COMPLETED' },
      });

      this.eventEmitter.emit('DISPUTE_RESOLVED', {
        disputeId: dispute.id,
        orderId: dispute.subOrderId,
        winner: 'SELLER',
        resolution: 'COMPLETE_ORDER',
        amount: 0,
      });
    }

    this.logger.log(`Dispute ${dispute.id} resolved: ${data.verdict}`);

    return updatedDispute;
  }

  async getPendingDisputes(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where: {
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
        },
        include: {
          buyer: {
            select: { id: true, fullName: true, email: true },
          },
          seller: {
            select: { id: true, fullName: true, email: true },
          },
          subOrder: {
            select: {
              id: true,
              grandTotal: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      data: disputes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateDisputeStatus(disputeId: string, status: DisputeStatus) {
    const dispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status },
    });

    this.logger.log(`Dispute ${disputeId} status updated to ${status}`);
    return dispute;
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentStateMachine {
  constructor(private prisma: PrismaService) {}

  private transitions: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['SUCCESS', 'FAILED', 'EXPIRED'],
    SUCCESS: ['REFUNDED'],
    FAILED: [],
    EXPIRED: [],
    REFUNDED: [],
  };

  canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return this.transitions[from]?.includes(to) ?? false;
  }

  async transition(paymentId: string, newStatus: PaymentStatus): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException(`Payment ${paymentId} not found`);
    }

    if (!this.canTransition(payment.status, newStatus)) {
      throw new BadRequestException(`Invalid transition from ${payment.status} to ${newStatus}`);
    }

    // Update status
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: newStatus },
    });

    // Simpan history (opsional, bisa pakai AuditLog)
    // await this.prisma.auditLog.create({ ... })
  }
}

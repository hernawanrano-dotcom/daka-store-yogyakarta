import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MidtransClient } from '../payment/midtrans.client';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private prisma: PrismaService,
    private midtrans: MidtransClient,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async reconcileDaily() {
    this.logger.log('Starting daily reconciliation...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // 1. Get all payments from DB
    const dbPayments = await this.prisma.payment.findMany({
      where: {
        created_at: {
          gte: yesterday,
          lte: today,
        },
      },
    });

    // 2. Compare with Midtrans (mock)
    let mismatchCount = 0;

    for (const payment of dbPayments) {
      // Mock: cek mismatch
      const isMatch = true; // Di sini nanti panggil Midtrans API
      
      if (!isMatch) {
        mismatchCount++;
        this.logger.warn(`Mismatch found for payment: ${payment.id}`);
        
        // Create alert
        await this.prisma.outboxMessage.create({
          data: {
            event_name: 'RECONCILIATION_MISMATCH',
            aggregate_id: payment.id,
            payload: {
              paymentId: payment.id,
              dbStatus: payment.status,
              midtransStatus: 'unknown',
              date: new Date().toISOString(),
            },
            status: 'pending',
          },
        });
      }
    }

    // 3. Get ledger balance
    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        created_at: {
          gte: yesterday,
          lte: today,
        },
      },
    });

    const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);

    // 4. Check if journal is balanced
    const isBalanced = totalDebit === totalCredit;

    if (!isBalanced) {
      this.logger.error(`Journal is NOT balanced! Debit: ${totalDebit}, Credit: ${totalCredit}`);
      
      await this.prisma.outboxMessage.create({
        data: {
          event_name: 'JOURNAL_IMBALANCE',
          aggregate_id: 'system',
          payload: {
            totalDebit,
            totalCredit,
            difference: totalDebit - totalCredit,
            date: new Date().toISOString(),
          },
          status: 'pending',
        },
      });
    } else {
      this.logger.log(`Journal is balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    this.logger.log(`Reconciliation completed. Mismatches: ${mismatchCount}`);
  }
}
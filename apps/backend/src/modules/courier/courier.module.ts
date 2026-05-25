// apps/backend/src/modules/courier/courier.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { CourierRegistry } from './courier.registry';
import { WebhookController } from './webhook/webhook.controller';

// Adapters
import { JntAdapter } from './adapters/jnt.adapter';
import { DakaSamedayAdapter } from './adapters/daka-sameday.adapter';
import { DakaInstantAdapter } from './adapters/daka-instant.adapter';
import { HeronaAdapter } from './adapters/herona.adapter';
import { GojekAdapter } from './adapters/gojek.adapter';
import { GrabAdapter } from './adapters/grab.adapter';
import { PosAdapter } from './adapters/pos.adapter';

@Module({
  imports: [BullModule.registerQueue({ name: 'tracking' }, { name: 'polling' })],
  controllers: [CourierController, WebhookController],
  providers: [
    // Core Services
    PrismaService,
    CourierService,
    CourierRegistry,

    // Adapters (semua di-inject)
    JntAdapter,
    DakaSamedayAdapter,
    DakaInstantAdapter,
    HeronaAdapter,
    GojekAdapter,
    GrabAdapter,
    PosAdapter, // Walaupun belum full implementasi, tetap di-provide
  ],
  exports: [CourierService, CourierRegistry],
})
export class CourierModule {}

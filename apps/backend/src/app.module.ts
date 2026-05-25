import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';

// Domain Modules - AI-1 (User & Auth)
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';

// Domain Modules - AI-2 (Product)
import { ProductModule } from './modules/product/product.module';
import { ReviewModule } from './modules/review/review.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { AddressModule } from './modules/address/address.module';

// Domain Modules - AI-3 (Payment & Ledger)
import { PaymentModule } from './modules/payment/payment.module';
import { LedgerModule } from './modules/ledger/ledger.module';

// Domain Modules - AI-4 (Courier & Tracking)
import { CourierModule } from './modules/courier/courier.module';

// Domain Modules - AI-5 (Cart, Order, Voucher)
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { VoucherModule } from './modules/voucher/voucher.module';

// Domain Modules - AI-6 (Engagement)
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FlashSaleModule } from './modules/flash-sale/flash-sale.module';
import { DisputeModule } from './modules/dispute/dispute.module';

@Module({
  imports: [
    // Core Modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    // Infrastructure Modules
    PrismaModule,
    RedisModule,
    QueueModule,

    // Domain Modules - AI-1 (User & Auth)
    UserModule,
    AuthModule,

    // Domain Modules - AI-2 (Product)
    ProductModule,
    ReviewModule,
    WishlistModule,

    // Domain Modules - AI-3 (Payment & Ledger)
    PaymentModule,
    LedgerModule,

    // Domain Modules - AI-4 (Courier & Tracking)
    CourierModule,

    // Domain Modules - AI-5 (Cart, Order, Voucher) ✅ SUDAH DI-IMPORT
    CartModule,
    OrderModule,
    AddressModule,
    VoucherModule,

    // Domain Modules - AI-6 (Engagement)
    ChatModule,
    NotificationModule,
    FlashSaleModule,
    DisputeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

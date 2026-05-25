import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { CloudinaryModule } from '../../../infrastructure/cloudinary/cloudinary.module';
import { MeilisearchModule } from '../../../infrastructure/meilisearch/meilisearch.module';

// Domain Modules - AI-1 (Core)
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';

// Domain Modules - AI-2 (Product)
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { ReviewModule } from './modules/review/review.module';

// Domain Modules - AI-3 (Payment & Ledger)
import { PaymentModule } from './modules/payment/payment.module';
import { LedgerModule } from './modules/ledger/ledger.module';

// Domain Modules - AI-4 (Courier)
import { CourierModule } from './modules/courier/courier.module';

// Domain Modules - AI-5 (Order)
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
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Infrastructure (Global)
    PrismaModule,
    QueueModule,
    CloudinaryModule,
    MeilisearchModule,

    // Domain Modules - AI-1
    UserModule,
    AuthModule,

    // Domain Modules - AI-2 (PRODUCT ENGINEER - GUE)
    CategoryModule,
    ProductModule,
    WishlistModule,
    ReviewModule,

    // Domain Modules - AI-3
    PaymentModule,
    LedgerModule,

    // Domain Modules - AI-4
    CourierModule,

    // Domain Modules - AI-5
    CartModule,
    OrderModule,
    VoucherModule,

    // Domain Modules - AI-6
    ChatModule,
    NotificationModule,
    FlashSaleModule,
    DisputeModule,
  ],
})
export class AppModule {}
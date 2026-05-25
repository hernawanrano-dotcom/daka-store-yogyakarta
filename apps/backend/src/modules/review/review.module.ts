import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ReviewEventHandler } from './review.event-handler';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { CloudinaryModule } from '../../../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, QueueModule, CloudinaryModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewEventHandler],
  exports: [ReviewService],
})
export class ReviewModule {}

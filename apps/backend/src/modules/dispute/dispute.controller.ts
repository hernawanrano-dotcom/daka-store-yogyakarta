import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DisputeService } from './dispute.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DisputeReason } from '@prisma/client';
import { UserRole } from '@daka/shared-types';

interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

export class CreateDisputeBody {
  subOrderId: string;
  reason: DisputeReason;
  description: string;
  proposedAmount?: number;
}

export class ResolveDisputeBody {
  verdict: 'BUYER_WIN' | 'SELLER_WIN';
  notes: string;
}

export class AddMessageBody {
  message: string;
}

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private disputeService: DisputeService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'evidence', maxCount: 10 }]))
  async createDispute(
    @Req() req: RequestWithUser,
    @Body() body: CreateDisputeBody,
    @UploadedFiles() files: { evidence?: Express.Multer.File[] }
  ) {
    // Get order details to get sellerId
    const subOrder = await this.prisma?.subOrder.findUnique({
      where: { id: body.subOrderId },
      select: { sellerId: true },
    });

    const dispute = await this.disputeService.createDispute({
      subOrderId: body.subOrderId,
      buyerId: req.user.id,
      sellerId: subOrder?.sellerId || '',
      reason: body.reason,
      description: body.description,
      evidenceFiles: files?.evidence,
      proposedAmount: body.proposedAmount,
    });

    return {
      success: true,
      message: 'Dispute created successfully',
      data: dispute,
    };
  }

  @Get()
  async getUserDisputes(
    @Req() req: RequestWithUser,
    @Query('role') role: 'buyer' | 'seller',
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ) {
    const disputes = await this.disputeService.getUserDisputes(
      req.user.id,
      role || 'buyer',
      +page,
      +limit
    );
    return {
      success: true,
      message: 'Disputes retrieved successfully',
      data: disputes.data,
      meta: disputes.meta,
    };
  }

  @Get(':id')
  async getDispute(@Req() req: RequestWithUser, @Param('id') id: string) {
    const dispute = await this.disputeService.getDispute(id, req.user.id, req.user.role);
    return {
      success: true,
      message: 'Dispute retrieved successfully',
      data: dispute,
    };
  }

  @Post(':id/messages')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  async addMessage(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: AddMessageBody,
    @UploadedFiles() files: { images?: Express.Multer.File[] }
  ) {
    const message = await this.disputeService.addMessage({
      disputeId: id,
      userId: req.user.id,
      message: body.message,
      imageFiles: files?.images,
    });
    return {
      success: true,
      message: 'Message added successfully',
      data: message,
    };
  }

  @Put(':id/resolve')
  @Roles(UserRole.admin)
  @UseGuards(RolesGuard)
  async resolveDispute(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: ResolveDisputeBody
  ) {
    const dispute = await this.disputeService.resolveDispute({
      disputeId: id,
      adminId: req.user.id,
      verdict: body.verdict,
      notes: body.notes,
    });
    return {
      success: true,
      message: 'Dispute resolved successfully',
      data: dispute,
    };
  }

  @Get('admin/pending')
  @Roles(UserRole.admin)
  @UseGuards(RolesGuard)
  async getPendingDisputes(@Query('page') page = 1, @Query('limit') limit = 10) {
    const disputes = await this.disputeService.getPendingDisputes(+page, +limit);
    return {
      success: true,
      message: 'Pending disputes retrieved successfully',
      data: disputes.data,
      meta: disputes.meta,
    };
  }
}

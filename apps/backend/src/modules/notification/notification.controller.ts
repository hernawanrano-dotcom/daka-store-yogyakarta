import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';

interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(
    @Req() req: RequestWithUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ) {
    const result = await this.notificationService.getUserNotifications(req.user.id, +page, +limit);
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('unread/count')
  async getUnreadCount(@Req() req: RequestWithUser) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return {
      success: true,
      message: 'Unread count retrieved',
      data: { count },
    };
  }

  @Put(':id/read')
  async markAsRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    const notification = await this.notificationService.markAsRead(id, req.user.id);
    return {
      success: true,
      message: 'Notification marked as read',
      data: notification,
    };
  }

  @Put('read-all')
  async markAllAsRead(@Req() req: RequestWithUser) {
    const result = await this.notificationService.markAllAsRead(req.user.id);
    return {
      success: true,
      message: 'All notifications marked as read',
      data: { count: result.count },
    };
  }
}

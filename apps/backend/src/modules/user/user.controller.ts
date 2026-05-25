import { Controller, Get, Put, Post, Body, Req, Delete, Param } from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { UpdateProfileDto, ChangePasswordDto, SwitchRoleDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user: { sub: string; role: string; deviceId: string };
}

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  async getProfile(@CurrentUser() currentUser: { sub: string }) {
    const user = await this.userService.findById(currentUser.sub);
    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
    };
  }

  @Put('me')
  async updateProfile(@CurrentUser() currentUser: { sub: string }, @Body() dto: UpdateProfileDto) {
    const user = await this.userService.updateProfile(currentUser.sub, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data: user,
    };
  }

  @Post('change-password')
  async changePassword(@CurrentUser() currentUser: { sub: string }, @Body() dto: ChangePasswordDto) {
    await this.userService.changePassword(currentUser.sub, dto);
    return {
      success: true,
      message: 'Password changed successfully',
      data: null,
    };
  }

  @Post('switch-role')
  async switchRole(
    @CurrentUser() currentUser: { sub: string; deviceId: string },
    @Body() dto: SwitchRoleDto,
  ) {
    const result = await this.userService.switchRole(currentUser.sub, dto, currentUser.deviceId);
    return {
      success: true,
      message: `Role switched to ${dto.role} successfully`,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    };
  }

  @Get('devices')
  async getDevices(@CurrentUser() currentUser: { sub: string }) {
    const devices = await this.userService.getDevices(currentUser.sub);
    return {
      success: true,
      message: 'Devices retrieved successfully',
      data: devices,
    };
  }

  @Delete('devices/:deviceId')
  async revokeDevice(
    @CurrentUser() currentUser: { sub: string },
    @Param('deviceId') deviceId: string,
  ) {
    await this.userService.revokeDevice(currentUser.sub, deviceId);
    return {
      success: true,
      message: 'Device revoked successfully',
      data: null,
    };
  }

  @Delete('devices')
  async revokeAllDevices(
    @CurrentUser() currentUser: { sub: string; deviceId: string },
  ) {
    await this.userService.revokeAllDevices(currentUser.sub, currentUser.deviceId);
    return {
      success: true,
      message: 'All devices revoked successfully',
      data: null,
    };
  }
}
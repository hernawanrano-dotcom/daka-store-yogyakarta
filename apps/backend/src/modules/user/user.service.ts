import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { comparePassword, hashPassword } from '@daka/shared-utils';
import { UpdateProfileDto, ChangePasswordDto, SwitchRoleDto } from './dto';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { UserEvents } from '@daka/shared-events';
import { UserRole } from '@daka/shared-types';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventBus: EventBusService
  ) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar: true,
        role: true,
        is_verified: true,
        is_blocked: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        full_name: dto.fullName,
        phone: dto.phone,
        avatar: dto.avatar,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar: true,
        role: true,
        is_verified: true,
        is_blocked: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOldPasswordValid = await comparePassword(dto.oldPassword, user.password_hash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    const hashedNewPassword = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedNewPassword },
    });

    // Revoke all sessions after password change
    await this.prisma.userSession.updateMany({
      where: { user_id: userId, is_revoked: false },
      data: { is_revoked: true },
    });

    return { success: true };
  }

  async switchRole(userId: string, dto: SwitchRoleDto, deviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fromRole = user.role;
    const toRole = dto.role as UserRole;

    if (fromRole === toRole) {
      throw new BadRequestException(`Already a ${toRole}`);
    }

    // If switching to seller, ensure email is verified
    if (toRole === 'seller' && !user.is_verified) {
      throw new ForbiddenException('Email must be verified to become a seller');
    }

    // Update role
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: toRole },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar: true,
        role: true,
        is_verified: true,
        is_blocked: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Publish USER_SWITCH_ROLE event
    await this.eventBus.publishOutbox('USER_SWITCH_ROLE', {
      userId: user.id,
      fromRole,
      toRole,
      switchedAt: new Date().toISOString(),
    });

    // Generate new access token with new role
    const newAccessToken = this.jwtService.sign(
      { sub: user.id, role: toRole, deviceId },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }
    );

    return {
      user: updatedUser,
      accessToken: newAccessToken,
    };
  }

  async verifyEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, is_verified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_verified) {
      throw new BadRequestException('Email already verified');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { is_verified: true },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar: true,
        role: true,
        is_verified: true,
        is_blocked: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    await this.eventBus.publishOutbox(UserEvents.USER_EMAIL_VERIFIED, {
      userId: updatedUser.id,
      email: updatedUser.email,
      verifiedAt: new Date().toISOString(),
    });

    return updatedUser;
  }

  async blockUser(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, is_blocked: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_blocked) {
      throw new BadRequestException('User is already blocked');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { is_blocked: true },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar: true,
        role: true,
        is_verified: true,
        is_blocked: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    await this.eventBus.publishOutbox(UserEvents.USER_BLOCKED, {
      userId: updatedUser.id,
      email: updatedUser.email,
      blockedBy: adminId,
      blockedAt: new Date().toISOString(),
    });

    return updatedUser;
  }

  async getDevices(userId: string) {
    const devices = await this.prisma.userDevice.findMany({
      where: { user_id: userId },
      select: {
        device_id: true,
        device_name: true,
        is_current: true,
        last_active: true,
        created_at: true,
      },
    });

    return devices;
  }

  async revokeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: {
        user_id: userId,
        device_id: deviceId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Cannot revoke current device
    if (device.is_current) {
      throw new BadRequestException('Cannot revoke current device');
    }

    // Delete device
    await this.prisma.userDevice.delete({
      where: { id: device.id },
    });

    // Revoke all sessions for this device
    // Note: In a real implementation, you'd need to track which sessions belong to which device
    // For simplicity, we're just deleting the device record

    return { success: true };
  }

  async revokeAllDevices(userId: string, currentDeviceId: string) {
    // Delete all devices except current
    await this.prisma.userDevice.deleteMany({
      where: {
        user_id: userId,
        device_id: { not: currentDeviceId },
      },
    });

    // Revoke all sessions except current
    // Note: In a real implementation, you'd need to track which sessions belong to which device

    return { success: true };
  }
}

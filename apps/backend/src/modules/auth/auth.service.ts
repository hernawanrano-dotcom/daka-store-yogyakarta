import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, comparePassword } from '@daka/shared-utils';
import { RegisterDto, LoginDto } from './dto';
import { UserRole } from '@daka/shared-types';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventBus: EventBusService
  ) {}

  async register(dto: RegisterDto) {
    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: hashedPassword,
        full_name: dto.fullName,
        phone: dto.phone,
        role: dto.role || UserRole.buyer,
        is_verified: false,
        is_blocked: false,
      },
    });

    // Publish USER_REGISTERED event (via outbox)
    await this.eventBus.publishOutbox('USER_REGISTERED', {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      registeredAt: new Date().toISOString(),
    });

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string, deviceId: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.logLoginAttempt(dto.email, ipAddress, userAgent, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is blocked
    if (user.is_blocked) {
      await this.logLoginAttempt(user.id, ipAddress, userAgent, false);
      throw new UnauthorizedException('Account is blocked');
    }

    // Verify password
    const isPasswordValid = await comparePassword(dto.password, user.password_hash);
    if (!isPasswordValid) {
      await this.logLoginAttempt(user.id, ipAddress, userAgent, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if this is a new device
    const existingDevice = await this.prisma.userDevice.findUnique({
      where: { device_id: deviceId },
    });

    const isNewDevice = !existingDevice;

    // Update or create device
    await this.prisma.userDevice.upsert({
      where: { device_id: deviceId },
      update: {
        last_active: new Date(),
        is_current: true,
      },
      create: {
        user_id: user.id,
        device_name: userAgent.substring(0, 100),
        device_id: deviceId,
        is_current: true,
      },
    });

    // Set all other devices to not current
    await this.prisma.userDevice.updateMany({
      where: {
        user_id: user.id,
        device_id: { not: deviceId },
      },
      data: { is_current: false },
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role, deviceId);

    // Save refresh token to database (hashed)
    const hashedRefreshToken = await hashPassword(refreshToken);
    await this.prisma.userSession.create({
      data: {
        user_id: user.id,
        refresh_token: hashedRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log successful login
    await this.logLoginAttempt(user.id, ipAddress, userAgent, true);

    // Publish USER_LOGIN event
    await this.eventBus.publishOutbox('USER_LOGIN', {
      userId: user.id,
      deviceId,
      ipAddress,
      userAgent,
      loginAt: new Date().toISOString(),
    });

    // If new device, send notification email
    if (isNewDevice) {
      await this.eventBus.publishOutbox('NEW_DEVICE_LOGIN', {
        userId: user.id,
        deviceName: userAgent.substring(0, 100),
        ipAddress,
        loginAt: new Date().toISOString(),
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const { password_hash, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  }

  async refreshToken(refreshToken: string, deviceId: string) {
    // Find session
    const sessions = await this.prisma.userSession.findMany({
      where: {
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    // Find matching session by comparing hashed refresh token
    let validSession = null;
    for (const session of sessions) {
      const isValid = await comparePassword(refreshToken, session.refresh_token);
      if (isValid) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if device exists
    const device = await this.prisma.userDevice.findUnique({
      where: { device_id: deviceId },
    });

    if (!device || device.user_id !== validSession.user_id) {
      throw new UnauthorizedException('Device mismatch');
    }

    // Revoke old session
    await this.prisma.userSession.update({
      where: { id: validSession.id },
      data: { is_revoked: true },
    });

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(
      validSession.user_id,
      validSession.user.role,
      deviceId
    );

    // Save new refresh token
    const hashedNewRefreshToken = await hashPassword(newRefreshToken);
    await this.prisma.userSession.create({
      data: {
        user_id: validSession.user_id,
        refresh_token: hashedNewRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string, deviceId: string) {
    // Find and revoke session
    const sessions = await this.prisma.userSession.findMany({
      where: { is_revoked: false },
    });

    for (const session of sessions) {
      const isValid = await comparePassword(refreshToken, session.refresh_token);
      if (isValid) {
        await this.prisma.userSession.update({
          where: { id: session.id },
          data: { is_revoked: true },
        });

        // Publish USER_LOGOUT event
        await this.eventBus.publishOutbox('USER_LOGOUT', {
          userId: session.user_id,
          deviceId,
          logoutAt: new Date().toISOString(),
        });

        break;
      }
    }

    return { success: true };
  }

  private async generateTokens(userId: string, role: UserRole, deviceId: string) {
    const payload = { sub: userId, role, deviceId };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: userId, deviceId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }
    );

    return { accessToken, refreshToken };
  }

  private async logLoginAttempt(
    userIdOrEmail: string,
    ipAddress: string,
    userAgent: string,
    success: boolean
  ) {
    let userId: string | null = null;

    if (success || userIdOrEmail.includes('@')) {
      // If email, try to find user
      if (userIdOrEmail.includes('@')) {
        const user = await this.prisma.user.findUnique({
          where: { email: userIdOrEmail },
          select: { id: true },
        });
        userId = user?.id || null;
      } else {
        userId = userIdOrEmail;
      }
    }

    await this.prisma.loginHistory.create({
      data: {
        user_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent,
        success,
      },
    });
  }
}

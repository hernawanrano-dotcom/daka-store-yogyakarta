import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@daka/shared-config';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAddressDto) {
    // If this is the first address, make it primary
    const addressCount = await this.prisma.address.count({
      where: { user_id: userId, deleted_at: null },
    });

    const isPrimary = dto.isPrimary ?? addressCount === 0;

    // If setting as primary, unset other primary addresses
    if (isPrimary) {
      await this.prisma.address.updateMany({
        where: { user_id: userId, is_primary: true },
        data: { is_primary: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        user_id: userId,
        label: dto.label,
        recipient_name: dto.recipientName,
        phone: dto.phone,
        address_line: dto.addressLine,
        subdistrict: dto.subdistrict,
        district: dto.district,
        city: dto.city,
        province: dto.province,
        postal_code: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        is_primary: isPrimary,
      },
    });

    return address;
  }

  async findAll(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'desc' }],
    });

    return addresses;
  }

  async findOne(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    // Check if address exists
    await this.findOne(userId, addressId);

    // If setting as primary, unset other primary addresses
    if (dto.isPrimary) {
      await this.prisma.address.updateMany({
        where: { user_id: userId, is_primary: true },
        data: { is_primary: false },
      });
    }

    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        label: dto.label,
        recipient_name: dto.recipientName,
        phone: dto.phone,
        address_line: dto.addressLine,
        subdistrict: dto.subdistrict,
        district: dto.district,
        city: dto.city,
        province: dto.province,
        postal_code: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        is_primary: dto.isPrimary,
      },
    });

    return address;
  }

  async remove(userId: string, addressId: string) {
    const address = await this.findOne(userId, addressId);

    // Cannot delete primary address if it's the only one
    const addressCount = await this.prisma.address.count({
      where: { user_id: userId, deleted_at: null },
    });

    if (address.is_primary && addressCount === 1) {
      throw new BadRequestException('Cannot delete the only address. Add another address first.');
    }

    // Soft delete
    const deletedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: { deleted_at: new Date() },
    });

    // If deleted address was primary, set another address as primary
    if (address.is_primary) {
      const newPrimary = await this.prisma.address.findFirst({
        where: { user_id: userId, deleted_at: null },
        orderBy: { created_at: 'asc' },
      });

      if (newPrimary) {
        await this.prisma.address.update({
          where: { id: newPrimary.id },
          data: { is_primary: true },
        });
      }
    }

    return { success: true };
  }

  async setPrimary(userId: string, addressId: string) {
    await this.findOne(userId, addressId);

    // Unset all primary addresses
    await this.prisma.address.updateMany({
      where: { user_id: userId, is_primary: true },
      data: { is_primary: false },
    });

    // Set new primary
    await this.prisma.address.update({
      where: { id: addressId },
      data: { is_primary: true },
    });

    return { success: true };
  }
}
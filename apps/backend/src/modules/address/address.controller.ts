import { Controller, Get, Post, Put, Delete, Body, Param, Patch } from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('addresses')
export class AddressController {
  constructor(private addressService: AddressService) {}

  @Post()
  async create(@CurrentUser() currentUser: { sub: string }, @Body() dto: CreateAddressDto) {
    const address = await this.addressService.create(currentUser.sub, dto);
    return {
      success: true,
      message: 'Address created successfully',
      data: address,
    };
  }

  @Get()
  async findAll(@CurrentUser() currentUser: { sub: string }) {
    const addresses = await this.addressService.findAll(currentUser.sub);
    return {
      success: true,
      message: 'Addresses retrieved successfully',
      data: addresses,
    };
  }

  @Get(':id')
  async findOne(@CurrentUser() currentUser: { sub: string }, @Param('id') id: string) {
    const address = await this.addressService.findOne(currentUser.sub, id);
    return {
      success: true,
      message: 'Address retrieved successfully',
      data: address,
    };
  }

  @Put(':id')
  async update(
    @CurrentUser() currentUser: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto
  ) {
    const address = await this.addressService.update(currentUser.sub, id, dto);
    return {
      success: true,
      message: 'Address updated successfully',
      data: address,
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() currentUser: { sub: string }, @Param('id') id: string) {
    await this.addressService.remove(currentUser.sub, id);
    return {
      success: true,
      message: 'Address deleted successfully',
      data: null,
    };
  }

  @Patch(':id/primary')
  async setPrimary(@CurrentUser() currentUser: { sub: string }, @Param('id') id: string) {
    await this.addressService.setPrimary(currentUser.sub, id);
    return {
      success: true,
      message: 'Primary address updated successfully',
      data: null,
    };
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { BrokersService } from './brokers.service.js';

@Controller('brokers')
export class BrokersController {
  constructor(private readonly service: BrokersService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/capabilities')
  async capabilities(@Param('id') id: string) {
    return this.service.getCapabilities(id);
  }
}

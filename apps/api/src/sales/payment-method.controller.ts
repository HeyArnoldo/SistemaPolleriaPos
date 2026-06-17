import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  PaymentMethodService,
  createPaymentMethodSchema,
  CreatePaymentMethodDto,
} from './services/payment-method.service';
import { z } from 'zod';

const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly service: PaymentMethodService) {}

  @Get()
  @Roles()
  findAll() {
    return this.service.findAll();
  }

  @Get('active')
  @Roles()
  findActive() {
    return this.service.findActive();
  }

  @Get(':id')
  @Roles()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createPaymentMethodSchema)) dto: CreatePaymentMethodDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updatePaymentMethodSchema)) dto: Partial<CreatePaymentMethodDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

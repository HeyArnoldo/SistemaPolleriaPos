import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { SalesService } from './services/sales.service';
import {
  createSaleSchema,
  syncSalesSchema,
  cancelSaleSchema,
  CreateSaleDto,
  SyncSalesDto,
} from './dto/create-sale.dto';

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  createSale(
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleDto,
    @CurrentUser() user: User,
  ) {
    return this.salesService.createSale(dto, user);
  }

  @Post('sync')
  syncSales(
    @Body(new ZodValidationPipe(syncSalesSchema)) input: SyncSalesDto,
    @CurrentUser() user: User,
  ) {
    return this.salesService.syncSales(input, user);
  }

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.salesService.findAll({
      from,
      to,
      userId: userId ? parseInt(userId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/cancel')
  cancelSale(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(cancelSaleSchema)) body: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.salesService.cancelSale(id, body.reason, user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { SalesService } from './services/sales.service';
import { CashReportService } from './services/cash-report.service';
import { SalesResetService } from './services/sales-reset.service';
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
  constructor(
    private readonly salesService: SalesService,
    private readonly cashReportService: CashReportService,
    private readonly salesResetService: SalesResetService,
  ) {}

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

  @Get('export/cash-report')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async exportCashReport(
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.cashReportService.exportCashReport(startDate, endDate);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer as ArrayBuffer));
  }

  /** Admin-only: wipe ALL financial data (sales, items, payments, expenses) in a transaction. */
  @Delete('reset/all')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  resetSalesAll() {
    return this.salesResetService.resetAllFinancialData();
  }

  /** Admin-only: wipe financial data for a single Lima-timezone day (YYYY-MM-DD). */
  @Delete('reset/date/:date')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  resetSalesByDate(@Param('date') date: string) {
    return this.salesResetService.resetFinancialDataByDate(date);
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

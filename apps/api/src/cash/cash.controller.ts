import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { CashService } from './services/cash.service';
import {
  createExpenseSchema,
  CreateExpenseDto,
  syncExpensesSchema,
  SyncExpensesDto,
} from './dto/create-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('expenses')
  createExpense(
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
    @CurrentUser() user: User,
  ) {
    return this.cashService.createExpense(dto, user);
  }

  @Post('expenses/sync')
  syncExpenses(
    @Body(new ZodValidationPipe(syncExpensesSchema)) dtos: SyncExpensesDto,
    @CurrentUser() user: User,
  ) {
    return this.cashService.syncExpenses(dtos, user);
  }

  @Get('expenses')
  findExpenses(@Query('from') from: string, @Query('to') to: string) {
    return this.cashService.findAll({ from, to });
  }

  @Get('dashboard')
  getDashboard(@Query('from') from: string, @Query('to') to: string) {
    return this.cashService.getDashboard({ from, to });
  }
}

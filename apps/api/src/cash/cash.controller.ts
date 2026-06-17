import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { CashService } from './services/cash.service';
import {
  createExpenseSchema,
  syncExpensesSchema,
  CreateExpenseDto,
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
    @Body(new ZodValidationPipe(syncExpensesSchema)) input: SyncExpensesDto,
    @CurrentUser() user: User,
  ) {
    return this.cashService.syncExpenses(input, user);
  }

  @Get('expenses')
  findExpenses(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    // Map frontend param names (startDate/endDate) to service filter (from/to).
    // Guard against missing params: pass undefined so findAll returns all records.
    return this.cashService.findAll({ from: startDate, to: endDate });
  }

  @Delete('expenses/:id')
  deleteExpense(@Param('id', ParseIntPipe) id: number) {
    return this.cashService.deleteExpense(id);
  }

  @Get('dashboard')
  getDashboard(@Query('date') date?: string) {
    return this.cashService.getDashboard(date);
  }
}

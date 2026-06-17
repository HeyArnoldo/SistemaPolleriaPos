import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { PaymentMethod } from '../sales/entities/payment-method.entity';
import { Payment } from '../sales/entities/payment.entity';
import { Sale } from '../sales/entities/sale.entity';
import { CashService } from './services/cash.service';
import { CashController } from './cash.controller';
import { BIReportService } from './services/bi-report.service';
import { BIController } from './bi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, PaymentMethod, Payment, Sale])],
  providers: [CashService, BIReportService],
  controllers: [CashController, BIController],
  exports: [CashService],
})
export class CashModule {}

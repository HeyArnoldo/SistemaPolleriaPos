import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { PaymentMethod } from '../sales/entities/payment-method.entity';
import { CashService } from './services/cash.service';
import { CashController } from './cash.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, PaymentMethod])],
  providers: [CashService],
  controllers: [CashController],
  exports: [CashService],
})
export class CashModule {}

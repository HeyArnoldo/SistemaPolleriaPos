import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Payment } from './entities/payment.entity';
import { Product } from '../inventory/entities/product.entity';
import { SalesService } from './services/sales.service';
import { PaymentMethodService } from './services/payment-method.service';
import { SalesController } from './sales.controller';
import { PaymentMethodController } from './payment-method.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod, Sale, SaleItem, Payment, Product])],
  providers: [SalesService, PaymentMethodService],
  controllers: [SalesController, PaymentMethodController],
  exports: [SalesService, PaymentMethodService],
})
export class SalesModule {}

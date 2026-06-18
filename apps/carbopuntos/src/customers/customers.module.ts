import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { PointsBalance } from '../points/entities/points-balance.entity';
import { PointsMovement } from '../points/entities/points-movement.entity';
import { SedeCredential } from '../auth/entities/sede-credential.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './services/customers.service';
import { DniService } from './services/dni.service';
import { ServiceKeyGuard } from '../auth/guards/service-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, PointsBalance, PointsMovement, SedeCredential])],
  controllers: [CustomersController],
  providers: [CustomersService, DniService, ServiceKeyGuard],
  exports: [CustomersService],
})
export class CustomersModule {}

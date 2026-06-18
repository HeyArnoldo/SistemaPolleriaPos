import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { PointsBalance } from './entities/points-balance.entity';
import { PointsMovement } from './entities/points-movement.entity';
import { AdminAudit } from '../audit/entities/admin-audit.entity';
import { SedeCredential } from '../auth/entities/sede-credential.entity';
import { PointsController } from './points.controller';
import { PointsService } from './services/points.service';
import { ServiceKeyGuard } from '../auth/guards/service-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, PointsBalance, PointsMovement, AdminAudit, SedeCredential]),
  ],
  controllers: [PointsController],
  providers: [PointsService, ServiceKeyGuard],
  exports: [PointsService],
})
export class PointsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './config/typeorm.config';
import { validateEnv } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { CashModule } from './cash/cash.module';
import { SettingsModule } from './settings/settings.module';
import { RewardsModule } from './rewards/rewards.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    UsersModule,
    AuthModule,
    HealthModule,
    InventoryModule,
    SalesModule,
    CashModule,
    SettingsModule,
    RewardsModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { expiresToMs } from '../config/app.config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginAudit } from './entities/login-audit.entity';
import { LoginAuditService } from './login-audit.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([LoginAudit]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: Math.floor(expiresToMs(process.env.JWT_EXPIRES_IN ?? '7d') / 1000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginAuditService],
})
export class AuthModule {}

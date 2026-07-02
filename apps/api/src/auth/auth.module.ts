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
import { LoginLockoutAlert } from './entities/login-lockout-alert.entity';
import { LoginAuditService } from './login-audit.service';
import { LockoutService } from './lockout.service';
import { AlertService } from './alert.service';
import { LogAlertChannel, resolveAlertChannel } from './alerts/log-alert-channel';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([LoginAudit, LoginLockoutAlert]),
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
  providers: [
    AuthService,
    JwtStrategy,
    LoginAuditService,
    LockoutService,
    AlertService,
    LogAlertChannel,
    {
      provide: 'ALERT_CHANNEL',
      useFactory: (): ReturnType<typeof resolveAlertChannel> => resolveAlertChannel(),
    },
  ],
})
export class AuthModule {}

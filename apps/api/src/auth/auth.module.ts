import { Logger, Module } from '@nestjs/common';
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
import { resolveAlertChannel } from './alerts/log-alert-channel';
import { TotpCryptoService } from './totp-crypto.service';
import { TotpService } from './totp.service';

const TOTP_CRYPTO_TOKEN = 'TOTP_CRYPTO';

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
    TotpService,
    {
      provide: 'ALERT_CHANNEL',
      useFactory: (): ReturnType<typeof resolveAlertChannel> => resolveAlertChannel(),
    },
    {
      // TotpCryptoService is optional — null when TOTP_ENCRYPTION_KEY is absent.
      // Enrollment endpoints return 503 in that case; password login is unaffected.
      provide: TOTP_CRYPTO_TOKEN,
      useFactory: (): TotpCryptoService | null => {
        const svc = TotpCryptoService.tryCreate();
        if (!svc) {
          new Logger('AuthModule').warn(
            'TOTP_ENCRYPTION_KEY is not set — TOTP enrollment endpoints will return 503. ' +
              'Password login is unaffected.',
          );
        }
        return svc;
      },
    },
  ],
  exports: [TotpService, TOTP_CRYPTO_TOKEN],
})
export class AuthModule {}

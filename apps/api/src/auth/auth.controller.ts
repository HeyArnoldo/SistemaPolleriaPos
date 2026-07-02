import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Optional,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { TotpCryptoService } from './totp-crypto.service';
import { TotpService } from './totp.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { cookieOptions, SESSION_COOKIE } from '../config/app.config';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginAuditService } from './login-audit.service';
import { confirmEnrollSchema, ConfirmEnrollInput } from '@app/contracts';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
type LoginInput = z.infer<typeof loginSchema>;

const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
type AuditQuery = z.infer<typeof auditQuerySchema>;

function toSafeUser(user: User) {
  // totpSecret is an AES-256-GCM envelope — NEVER expose it.
  // totpEnabled is a safe boolean flag (no secret information).
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    totpEnabled: user.totpEnabled,
    profile: user.profile,
    createdAt: user.createdAt,
  };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly auditService: LoginAuditService,
    @Optional() @Inject('TOTP_CRYPTO') private readonly totpCrypto: TotpCryptoService | null,
    private readonly totpSvc: TotpService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = {
      ip: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    };
    const { user, token } = await this.auth.login(input, ctx);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    return toSafeUser(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return toSafeUser(user);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    const { maxAge: _omit, ...clear } = cookieOptions();
    res.clearCookie(SESSION_COOKIE, clear);
    return { ok: true };
  }

  @Get('login-audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listLoginAudit(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery) {
    return this.auditService.list(query.page, query.limit);
  }

  // ─── TOTP enrollment ────────────────────────────────────────────────────────

  /**
   * POST /auth/2fa/enroll
   *
   * Generates a TOTP secret for the current user, stores it encrypted,
   * and returns the otpauth:// provisioning URI + base32 secret for manual entry.
   * totpEnabled stays false until /enroll/confirm is called.
   *
   * Returns 403 if the current user is the sistema user (env-managed only).
   * Returns 503 if TOTP_ENCRYPTION_KEY is not configured.
   */
  @Post('2fa/enroll')
  @UseGuards(JwtAuthGuard)
  async enroll(@CurrentUser() current: User) {
    this.assertNotSistema(current);
    const crypto = this.requireCrypto();

    const secret = this.totpSvc.generateSecret();
    const otpauthUri = this.totpSvc.buildOtpauthUri(current.username, this.totpSvc.issuer, secret);
    const encrypted = crypto.encrypt(secret);

    // Store encrypted secret; keep totpEnabled=false (not yet confirmed)
    await this.users.update(current.id, { totpSecret: encrypted, totpEnabled: false });

    // Return the provisioning URI and the plaintext base32 for manual entry.
    // This is the ONLY time the plaintext secret is returned. Never log it.
    return { otpauthUri, secret };
  }

  /**
   * POST /auth/2fa/enroll/confirm { code }
   *
   * Verifies a live TOTP code against the pending secret.
   * On success: sets totpEnabled=true. On failure: 400 (no state change).
   */
  @Post('2fa/enroll/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmEnroll(
    @CurrentUser() current: User,
    @Body(new ZodValidationPipe(confirmEnrollSchema)) dto: ConfirmEnrollInput,
  ) {
    this.assertNotSistema(current);
    const crypto = this.requireCrypto();

    // Re-load to get the freshest stored secret
    const user = await this.users.findOne(current.id);
    if (!user.totpSecret) {
      throw new BadRequestException(
        'No pending TOTP enrollment found. Call /auth/2fa/enroll first.',
      );
    }

    let plainSecret: string;
    try {
      plainSecret = crypto.decrypt(user.totpSecret);
    } catch {
      // Corrupt envelope or rotated TOTP_ENCRYPTION_KEY — the stored secret is
      // unreadable. Never leak crypto internals; translate to a clean 4xx.
      throw new BadRequestException(
        'Stored TOTP secret is unreadable. Please re-enroll via /auth/2fa/enroll.',
      );
    }
    const valid = this.totpSvc.verify(dto.code, plainSecret);

    if (!valid) {
      throw new BadRequestException('Invalid TOTP code. Please try again.');
    }

    await this.users.update(current.id, { totpEnabled: true });
    return { enabled: true as const };
  }

  /**
   * POST /auth/2fa/reset/:userId (admin only)
   *
   * Clears 2FA for a target user (break-glass recovery).
   * Rejects operating on the sistema user (immutable via API).
   */
  @Post('2fa/reset/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async resetTotp(@CurrentUser() admin: User, @Param('userId', ParseIntPipe) userId: number) {
    const target = await this.users.findOne(userId);

    if (target.isSystem) {
      throw new ForbiddenException(
        'Cannot reset 2FA for the sistema user via the API. ' +
          'Manage SYSTEM_TOTP_SECRET in the environment.',
      );
    }

    await this.users.update(userId, { totpEnabled: false, totpSecret: null });

    // Audit trail for this break-glass admin action.
    // CP-01 LoginAuditService is intentionally login-scoped: its `reason` is a
    // constrained enum and it has no actor field, so a 2FA reset does not fit
    // its schema. We emit a structured Logger line carrying the acting admin
    // and the target user so the highest-privilege 2FA-removal has a trail.
    this.logger.log({
      action: '2fa_reset',
      actingAdminId: admin.id,
      targetUserId: userId,
      timestamp: new Date().toISOString(),
    });

    return { reset: true, userId };
  }

  // ─── private guards ───────────────────────────────────────────────────────

  private assertNotSistema(user: User): void {
    if (user.isSystem) {
      throw new ForbiddenException(
        'The sistema user cannot change TOTP settings via the API. ' +
          'Manage SYSTEM_TOTP_SECRET in the environment.',
      );
    }
  }

  private requireCrypto(): TotpCryptoService {
    if (!this.totpCrypto) {
      throw TotpCryptoService.unavailableError();
    }
    return this.totpCrypto;
  }
}

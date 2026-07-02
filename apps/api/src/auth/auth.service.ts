import { Injectable, Logger, UnauthorizedException, Inject, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { LoginAuditService, NewLoginAuditRow } from './login-audit.service';
import { LockoutService } from './lockout.service';
import { AlertService } from './alert.service';
import { TotpService } from './totp.service';
import { TotpCryptoService } from './totp-crypto.service';
import { TooManyAttemptsException } from './too-many-attempts.exception';
import { LockoutAlertPayload } from './alerts/alert-channel';
import { expiresToMs } from '../config/app.config';

export interface AuthResult {
  user: User;
  token: string;
}

export interface TwoFactorChallengeResult {
  twoFactorRequired: true;
  challengeToken: string;
}

export type LoginResult = AuthResult | TwoFactorChallengeResult;

export interface LoginInput {
  username: string;
  password: string;
}

export interface Login2faInput {
  challengeToken: string;
  code: string;
}

/** Request context forwarded from the controller. Optional for backward compat. */
export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

const DEFAULT_CTX: LoginContext = { ip: null, userAgent: null };
const DEFAULT_CHALLENGE_EXPIRES = '5m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: LoginAuditService,
    private readonly lockout: LockoutService,
    private readonly alertSvc: AlertService,
    @Optional() private readonly totpSvc: TotpService,
    @Optional() @Inject('TOTP_CRYPTO') private readonly totpCrypto: TotpCryptoService | null,
  ) {}

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
  }

  /**
   * Signs a short-lived JWT challenge token for the two-step login flow.
   * The token carries typ:'2fa_challenge' and is NOT usable as a session.
   */
  signChallengeToken(userId: number): string {
    const expiresInSec = Math.floor(
      expiresToMs(process.env.TOTP_CHALLENGE_EXPIRES ?? DEFAULT_CHALLENGE_EXPIRES) / 1000,
    );
    return this.jwt.sign({ sub: userId, typ: '2fa_challenge' }, { expiresIn: expiresInSec });
  }

  /**
   * Verifies a challenge token. Returns the userId on success.
   * Throws UnauthorizedException for expired, malformed, or wrong-typ tokens.
   */
  verifyChallengeToken(token: string): number {
    let payload: { sub: number; typ?: string };
    try {
      payload = this.jwt.verify<{ sub: number; typ?: string }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
    if (payload.typ !== '2fa_challenge') {
      throw new UnauthorizedException('Invalid challenge token');
    }
    return payload.sub;
  }

  /**
   * Best-effort audit helper: calls audit.record but absorbs any exception so
   * that a transient audit failure never turns a valid login into a 500 and
   * never masks a real UnauthorizedException with an audit DB error.
   */
  private async recordAudit(row: NewLoginAuditRow): Promise<void> {
    await this.audit.record(row).catch((e: unknown) => {
      this.logger.error('audit.record unexpectedly rejected in AuthService', e);
    });
  }

  /**
   * Best-effort alert helper: emits a lockout alert but absorbs any rejection so
   * that an alert failure never changes the thrown TooManyAttemptsException.
   */
  private emitAlertBestEffort(payload: LockoutAlertPayload): void {
    this.alertSvc.emit(payload).catch((e: unknown) => {
      this.logger.error('alertSvc.emit unexpectedly rejected in AuthService', e);
    });
  }

  async login(input: LoginInput, ctx: LoginContext = DEFAULT_CTX): Promise<LoginResult> {
    // CP-02: lockout gate — runs BEFORE password verification to avoid bcrypt cost under attack
    const locked = await this.lockout.isLocked(input.username);
    if (locked.isLocked) {
      this.emitAlertBestEffort({
        username: input.username,
        sede: process.env.STORE_ID ?? null,
        ipAddress: ctx.ip,
        failureCount: locked.failureCount,
        occurredAt: new Date(),
      });
      throw new TooManyAttemptsException();
    }

    // CP-01: normal auth flow — unchanged
    const user = await this.users.findByUsername(input.username);

    if (!user?.passwordHash) {
      await this.recordAudit({
        username: input.username,
        outcome: 'failure',
        reason: 'unknown_user',
        userId: user?.id ?? null,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await this.recordAudit({
        username: input.username,
        outcome: 'failure',
        reason: 'inactive',
        userId: user.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Account is deactivated');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      await this.recordAudit({
        username: input.username,
        outcome: 'failure',
        reason: 'bad_password',
        userId: user.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // CP-12 D3: two-step flow for TOTP-enabled users.
    // Password is correct — now branch on totpEnabled.
    if (user.totpEnabled) {
      // Do NOT issue a session. Return a short-lived challenge token.
      // Success audit is deferred to step-2 when the session is actually issued.
      const challengeToken = this.signChallengeToken(user.id);
      return { twoFactorRequired: true, challengeToken };
    }

    // Non-2FA path: unchanged behavior.
    await this.recordAudit({
      username: input.username,
      outcome: 'success',
      reason: null,
      userId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user, token: this.sign(user) };
  }

  /**
   * Step-2 of the two-factor login flow.
   *
   * Verifies:
   *   1. CP-02 lockout re-check for the user's username.
   *   2. The challenge token (signature + typ + expiry).
   *   3. The TOTP code against the stored encrypted secret.
   *
   * On success: returns { user, token } and writes a CP-01 success audit row.
   * On bad code: writes failure/bad_totp audit (counts toward CP-02 lockout) and throws.
   */
  async login2fa(input: Login2faInput, ctx: LoginContext = DEFAULT_CTX): Promise<AuthResult> {
    // Step A: verify the challenge token first so we have a userId for the lockout check.
    // UnauthorizedException here — no audit (token is invalid, username unknown at this point).
    const userId = this.verifyChallengeToken(input.challengeToken);

    // Step B: load user to get the username for the lockout check.
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    // Step C: CP-02 lockout re-check by username BEFORE verifying the code.
    // This prevents hammering the code endpoint and counts bad_totp failures.
    const locked = await this.lockout.isLocked(user.username);
    if (locked.isLocked) {
      this.emitAlertBestEffort({
        username: user.username,
        sede: process.env.STORE_ID ?? null,
        ipAddress: ctx.ip,
        failureCount: locked.failureCount,
        occurredAt: new Date(),
      });
      throw new TooManyAttemptsException();
    }

    // Step D: decrypt and verify TOTP code.
    let plainSecret: string;
    try {
      plainSecret = this.totpCrypto!.decrypt(user.totpSecret!);
    } catch {
      // Corrupt envelope — treat as auth failure, not a 500.
      await this.recordAudit({
        username: user.username,
        outcome: 'failure',
        reason: 'bad_totp',
        userId: user.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    const valid = this.totpSvc.verify(input.code, plainSecret);
    if (!valid) {
      await this.recordAudit({
        username: user.username,
        outcome: 'failure',
        reason: 'bad_totp',
        userId: user.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    // Step E: code is valid — issue the session and write success audit.
    await this.recordAudit({
      username: user.username,
      outcome: 'success',
      reason: null,
      userId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user, token: this.sign(user) };
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { LoginAuditService, NewLoginAuditRow } from './login-audit.service';

export interface AuthResult {
  user: User;
  token: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

/** Request context forwarded from the controller. Optional for backward compat. */
export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

const DEFAULT_CTX: LoginContext = { ip: null, userAgent: null };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: LoginAuditService,
  ) {}

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
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

  async login(input: LoginInput, ctx: LoginContext = DEFAULT_CTX): Promise<AuthResult> {
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
}

import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { cookieOptions, SESSION_COOKIE } from '../config/app.config';
import { User } from '../users/user.entity';
import { LoginAuditService } from './login-audit.service';

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
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    profile: user.profile,
    createdAt: user.createdAt,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly auditService: LoginAuditService,
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
}

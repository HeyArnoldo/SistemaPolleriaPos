import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { cookieOptions, SESSION_COOKIE } from '../config/app.config';
import { User } from '../users/user.entity';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
type LoginInput = z.infer<typeof loginSchema>;

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
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.login(input);
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
}

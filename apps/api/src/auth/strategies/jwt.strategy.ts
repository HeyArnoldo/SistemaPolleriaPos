import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/user.entity';
import { SESSION_COOKIE } from '../../config/app.config';
import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
}

/** Reads JWT from the httpOnly cookie (never from Authorization header). */
const cookieExtractor = (req: Request): string | null =>
  (req?.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid session');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    return user;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export interface AuthResult {
  user: User;
  token: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByUsername(input.username);
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { user, token: this.sign(user) };
  }
}

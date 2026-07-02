/**
 * T-jwt-strategy — JwtStrategy 2FA hardening (CP-12 / PR-a2).
 *
 * Verifies:
 *   - Normal session payload (no typ) is accepted and loads the user.
 *   - Payload with typ:'2fa_challenge' is REJECTED — a challenge token must
 *     never be usable as a session credential.
 *   - Inactive user is rejected regardless of token type.
 */
import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/user.entity';
import { Role } from '../../common/enums/role.enum';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 7;
  user.username = 'admin1';
  user.role = Role.Admin;
  user.isActive = true;
  user.isSystem = false;
  user.totpEnabled = false;
  return Object.assign(user, overrides);
}

function buildStrategy(user: User | null = makeUser()): {
  strategy: JwtStrategy;
  mockUsers: { findById: jest.Mock };
} {
  // JwtStrategy reads JWT_SECRET from the environment
  process.env.JWT_SECRET = 'test-jwt-secret-for-strategy-spec';

  const mockUsers = {
    findById: jest.fn().mockResolvedValue(user),
  };
  const strategy = new JwtStrategy(mockUsers as unknown as UsersService);
  return { strategy, mockUsers };
}

describe('JwtStrategy.validate — challenge token rejection (T-jwt-strategy)', () => {
  it('accepts a normal session payload (no typ field) and returns the user', async () => {
    const user = makeUser();
    const { strategy } = buildStrategy(user);

    const result = await strategy.validate({ sub: 7, username: 'admin1', role: Role.Admin });

    expect(result).toBe(user);
  });

  it('rejects a payload with typ="2fa_challenge" with UnauthorizedException', async () => {
    const { strategy } = buildStrategy(makeUser());

    await expect(
      strategy.validate({
        sub: 7,
        username: 'admin1',
        role: Role.Admin,
        typ: '2fa_challenge',
      } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException with message "Challenge token is not a session" for challenge typ', async () => {
    const { strategy } = buildStrategy(makeUser());

    await expect(strategy.validate({ sub: 7, typ: '2fa_challenge' } as any)).rejects.toThrow(
      'Challenge token is not a session',
    );
  });

  it('rejects even if the challenge payload user exists and is active', async () => {
    const { strategy } = buildStrategy(makeUser({ isActive: true }));

    await expect(strategy.validate({ sub: 7, typ: '2fa_challenge' } as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user for a normal session payload', async () => {
    const { strategy } = buildStrategy(makeUser({ isActive: false }));

    await expect(
      strategy.validate({ sub: 7, username: 'admin1', role: Role.Admin }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when user is not found', async () => {
    const { strategy } = buildStrategy(null);

    await expect(
      strategy.validate({ sub: 999, username: 'ghost', role: Role.Admin }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

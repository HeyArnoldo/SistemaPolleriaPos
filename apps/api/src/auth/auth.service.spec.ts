/**
 * T3.1 / T3.2 — AuthService with LoginAudit wiring.
 * Verifies:
 *   - audit.record is called with correct outcome/reason/userId/username for each branch
 *   - login return/throw is unchanged in all branches
 *   - best-effort: when audit.record rejects, a valid login still returns user+token
 *     and a failed login still throws the original UnauthorizedException
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, LoginContext } from './auth.service';
import { LoginAuditService } from './login-audit.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcryptjs';

// Use a pre-computed bcrypt hash for 'secret123' to avoid slow bcrypt in unit tests.
// Generated with bcrypt.hash('secret123', 4).
const PASSWORD = 'secret123';
const PASSWORD_HASH = '$2b$04$Lwx98uvV39P3yfpHX4ondOqEOvdHgQo0t6Y6MtmY/xre.hr7ryGCC';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 99;
  user.username = 'cajero1';
  user.passwordHash = PASSWORD_HASH;
  user.isActive = true;
  user.isSystem = false;
  user.role = Role.Cashier;
  user.profile = { id: 1, firstName: 'Juan', lastName: 'Rios' } as any;
  return Object.assign(user, overrides);
}

function buildService(): {
  service: AuthService;
  mockUsers: { findByUsername: jest.Mock };
  mockAudit: { record: jest.Mock; list: jest.Mock };
  mockJwt: { sign: jest.Mock };
} {
  const mockUsers = { findByUsername: jest.fn() };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
  const mockJwt = { sign: jest.fn().mockReturnValue('jwt-token') };

  const service = new AuthService(
    mockUsers as unknown as UsersService,
    mockJwt as unknown as JwtService,
    mockAudit as unknown as LoginAuditService,
  );

  return { service, mockUsers, mockAudit, mockJwt };
}

const ctx: LoginContext = { ip: '127.0.0.1', userAgent: 'Jest/1.0' };

describe('AuthService.login — audit wiring (T3.1)', () => {
  describe('successful login', () => {
    it('records outcome=success with userId and username', async () => {
      const { service, mockUsers, mockAudit } = buildService();
      const user = makeUser();
      mockUsers.findByUsername.mockResolvedValue(user);

      await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cajero1',
          outcome: 'success',
          reason: null,
          userId: 99,
          ipAddress: '127.0.0.1',
          userAgent: 'Jest/1.0',
        }),
      );
    });

    it('still returns user + token on success', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

      expect(result.user).toBeDefined();
      expect(result.token).toBe('jwt-token');
    });
  });

  describe('unknown user branch', () => {
    it('records outcome=failure / reason=unknown_user / userId=null', async () => {
      const { service, mockUsers, mockAudit } = buildService();
      mockUsers.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' }, ctx)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'ghost',
          outcome: 'failure',
          reason: 'unknown_user',
          userId: null,
        }),
      );
    });

    it('still throws UnauthorizedException("Invalid credentials") for unknown user', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' }, ctx)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('inactive account branch', () => {
    it('records outcome=failure / reason=inactive with userId', async () => {
      const { service, mockUsers, mockAudit } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cajero1',
          outcome: 'failure',
          reason: 'inactive',
          userId: 99,
        }),
      );
    });

    it('still throws UnauthorizedException("Account is deactivated")', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        'Account is deactivated',
      );
    });
  });

  describe('bad password branch', () => {
    it('records outcome=failure / reason=bad_password with userId', async () => {
      const { service, mockUsers, mockAudit } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      await expect(
        service.login({ username: 'cajero1', password: 'wrong-pass' }, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cajero1',
          outcome: 'failure',
          reason: 'bad_password',
          userId: 99,
        }),
      );
    });

    it('still throws UnauthorizedException("Invalid credentials") for bad password', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      await expect(
        service.login({ username: 'cajero1', password: 'wrong-pass' }, ctx),
      ).rejects.toThrow('Invalid credentials');
    });
  });
});

describe('AuthService.login — best-effort audit (T3.2)', () => {
  it('valid login still returns user+token when audit.record rejects', async () => {
    const { service, mockUsers, mockAudit } = buildService();
    mockUsers.findByUsername.mockResolvedValue(makeUser());
    mockAudit.record.mockRejectedValue(new Error('DB down'));

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(result.user).toBeDefined();
    expect(result.token).toBe('jwt-token');
  });

  it('failed login still throws original UnauthorizedException when audit.record rejects', async () => {
    const { service, mockUsers, mockAudit } = buildService();
    mockUsers.findByUsername.mockResolvedValue(null);
    mockAudit.record.mockRejectedValue(new Error('DB down'));

    await expect(service.login({ username: 'ghost', password: 'any' }, ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('ctx defaults to null values when called without context (backward-compat)', async () => {
    const { service, mockUsers, mockAudit } = buildService();
    mockUsers.findByUsername.mockResolvedValue(makeUser());

    // Calling without ctx — should not throw a runtime error
    const result = await service.login({ username: 'cajero1', password: PASSWORD });

    expect(result.token).toBe('jwt-token');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});

describe('AuthService.login — user has passwordHash=null (edge case)', () => {
  it('treats missing passwordHash as unknown_user', async () => {
    const { service, mockUsers, mockAudit } = buildService();
    // User exists in DB but has no passwordHash (e.g. OAuth-only)
    mockUsers.findByUsername.mockResolvedValue(makeUser({ passwordHash: null as any }));

    await expect(service.login({ username: 'cajero1', password: 'any' }, ctx)).rejects.toThrow(
      'Invalid credentials',
    );

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unknown_user' }),
    );
  });
});

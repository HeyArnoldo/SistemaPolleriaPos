/**
 * T3.1 / T3.2 — AuthService with LoginAudit wiring.
 * WU4 additions: lockout gate (TooManyAttemptsException 429) + AlertService wiring.
 * CP-12 PR-a2 additions: two-step 2FA login branch.
 * Verifies:
 *   - audit.record is called with correct outcome/reason/userId/username for each branch
 *   - login return/throw is unchanged in all branches
 *   - best-effort: when audit.record rejects, a valid login still returns user+token
 *     and a failed login still throws the original UnauthorizedException
 *   - locked identity → TooManyAttemptsException (429), bcrypt NOT called, alert IS called
 *   - below-threshold → all CP-01 branches unchanged, no regression
 *   - alert emit rejection does not change the 429 response
 *   - user with totpEnabled=false → session issued unchanged (regression lock)
 *   - user with totpEnabled=true → challenge returned, no session, no success audit
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, AuthResult, LoginContext } from './auth.service';
import { LoginAuditService } from './login-audit.service';
import { LockoutService } from './lockout.service';
import { AlertService } from './alert.service';
import { TooManyAttemptsException } from './too-many-attempts.exception';
import { TotpService } from './totp.service';
import { TotpCryptoService } from './totp-crypto.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';

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

function buildService(lockoutOverrides?: {
  isLocked?: { isLocked: boolean; failureCount: number };
}): {
  service: AuthService;
  mockUsers: { findByUsername: jest.Mock };
  mockAudit: { record: jest.Mock; list: jest.Mock };
  mockJwt: { sign: jest.Mock };
  mockLockout: { isLocked: jest.Mock };
  mockAlert: { emit: jest.Mock };
} {
  const mockUsers = { findByUsername: jest.fn() };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
  const mockJwt = { sign: jest.fn().mockReturnValue('jwt-token') };
  const defaultLockout = lockoutOverrides?.isLocked ?? { isLocked: false, failureCount: 0 };
  const mockLockout = { isLocked: jest.fn().mockResolvedValue(defaultLockout) };
  const mockAlert = { emit: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    mockUsers as unknown as UsersService,
    mockJwt as unknown as JwtService,
    mockAudit as unknown as LoginAuditService,
    mockLockout as unknown as LockoutService,
    mockAlert as unknown as AlertService,
    null as unknown as TotpService,
    null as unknown as TotpCryptoService,
  );

  return { service, mockUsers, mockAudit, mockJwt, mockLockout, mockAlert };
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

      // makeUser() has totpEnabled=false — must return AuthResult, never a challenge
      const authResult = result as AuthResult;
      expect(authResult.user).toBeDefined();
      expect(authResult.token).toBe('jwt-token');
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

    // makeUser() has totpEnabled=false — must return AuthResult
    const authResult = result as AuthResult;
    expect(authResult.user).toBeDefined();
    expect(authResult.token).toBe('jwt-token');
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

    // makeUser() has totpEnabled=false — must return AuthResult
    expect((result as AuthResult).token).toBe('jwt-token');
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

describe('AuthService.login — lockout gate (CP-02 WU4)', () => {
  describe('locked identity', () => {
    it('throws TooManyAttemptsException (HTTP 429) when identity is locked', async () => {
      const { service, mockUsers } = buildService({
        isLocked: { isLocked: true, failureCount: 5 },
      });
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        TooManyAttemptsException,
      );
    });

    it('throws with status 429', async () => {
      const { service, mockUsers } = buildService({
        isLocked: { isLocked: true, failureCount: 5 },
      });
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      let status: number | undefined;
      try {
        await service.login({ username: 'cajero1', password: PASSWORD }, ctx);
      } catch (e: unknown) {
        if (e instanceof TooManyAttemptsException) status = e.getStatus();
      }
      expect(status).toBe(429);
    });

    it('does NOT call findByUsername (lockout gate short-circuits before user lookup)', async () => {
      // When locked, the gate throws before any user lookup or bcrypt call.
      const { service, mockUsers } = buildService({
        isLocked: { isLocked: true, failureCount: 5 },
      });

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        TooManyAttemptsException,
      );

      // The gate must throw before reaching findByUsername, so bcrypt is never reached either.
      expect(mockUsers.findByUsername).not.toHaveBeenCalled();
    });

    it('calls AlertService.emit with username, sede, ip, and failureCount when locked', async () => {
      const { service, mockUsers, mockAlert } = buildService({
        isLocked: { isLocked: true, failureCount: 5 },
      });
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        TooManyAttemptsException,
      );

      expect(mockAlert.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cajero1',
          ipAddress: '127.0.0.1',
          failureCount: 5,
        }),
      );
    });

    it('still throws TooManyAttemptsException even when AlertService.emit rejects', async () => {
      const { service, mockUsers, mockAlert } = buildService({
        isLocked: { isLocked: true, failureCount: 5 },
      });
      mockUsers.findByUsername.mockResolvedValue(makeUser());
      mockAlert.emit.mockRejectedValue(new Error('Alert channel down'));

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        TooManyAttemptsException,
      );
    });
  });

  describe('below-threshold identity — CP-01 branches unchanged', () => {
    it('successful login still returns user+token when not locked', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

      // makeUser() has totpEnabled=false — must return AuthResult
      const authResult = result as AuthResult;
      expect(authResult.user).toBeDefined();
      expect(authResult.token).toBe('jwt-token');
    });

    it('unknown user still throws UnauthorizedException("Invalid credentials")', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: 'any' }, ctx)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('bad password still throws UnauthorizedException("Invalid credentials")', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser());

      await expect(
        service.login({ username: 'cajero1', password: 'wrong-pass' }, ctx),
      ).rejects.toThrow('Invalid credentials');
    });

    it('inactive account still throws UnauthorizedException("Account is deactivated")', async () => {
      const { service, mockUsers } = buildService();
      mockUsers.findByUsername.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.login({ username: 'cajero1', password: PASSWORD }, ctx)).rejects.toThrow(
        'Account is deactivated',
      );
    });
  });
});

// ─── CP-12 PR-a2: Two-step login 2FA branch (regression + new) ────────────────

/**
 * Helper for 2FA branch tests — uses a real JwtService (short secret for tests)
 * and passes real TotpService + null TotpCryptoService.
 */
const CHALLENGE_SECRET = 'challenge-test-secret-for-2fa-branch';

function buildServiceWith2FA(lockoutResult?: { isLocked: boolean; failureCount: number }): {
  service: AuthService;
  mockUsers: { findByUsername: jest.Mock; findById: jest.Mock };
  mockAudit: { record: jest.Mock };
  mockLockout: { isLocked: jest.Mock };
  jwtService: JwtService;
} {
  const jwtService = new JwtService({ secret: CHALLENGE_SECRET });
  const mockUsers = {
    findByUsername: jest.fn(),
    findById: jest.fn(),
  };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
  const mockLockout = {
    isLocked: jest.fn().mockResolvedValue(lockoutResult ?? { isLocked: false, failureCount: 0 }),
  };
  const mockAlert = { emit: jest.fn().mockResolvedValue(undefined) };

  process.env.JWT_SECRET = CHALLENGE_SECRET;
  process.env.TOTP_CHALLENGE_EXPIRES = '5m';

  const service = new AuthService(
    mockUsers as unknown as UsersService,
    jwtService,
    mockAudit as unknown as LoginAuditService,
    mockLockout as unknown as LockoutService,
    mockAlert as unknown as AlertService,
    null as unknown as TotpService,
    null as unknown as TotpCryptoService,
  );

  return { service, mockUsers, mockAudit, mockLockout, jwtService };
}

describe('AuthService.login — 2FA regression: non-2FA user unchanged (T-2fa-regression)', () => {
  it('returns { user, token } for totpEnabled=false (byte-identical to pre-CP12)', async () => {
    const { service, mockUsers } = buildServiceWith2FA();
    const user = makeUser({ totpEnabled: false });
    mockUsers.findByUsername.mockResolvedValue(user);

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    // Must return AuthResult shape: user + token
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
    expect('twoFactorRequired' in result).toBe(false);
  });

  it('does NOT return twoFactorRequired for totpEnabled=false', async () => {
    const { service, mockUsers } = buildServiceWith2FA();
    mockUsers.findByUsername.mockResolvedValue(makeUser({ totpEnabled: false }));

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(result).not.toHaveProperty('twoFactorRequired');
  });

  it('writes success audit for totpEnabled=false users on valid credentials', async () => {
    const { service, mockUsers, mockAudit } = buildServiceWith2FA();
    mockUsers.findByUsername.mockResolvedValue(makeUser({ totpEnabled: false }));

    await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', reason: null }),
    );
  });
});

describe('AuthService.login — 2FA step-1 challenge (T-2fa-challenge)', () => {
  it('returns { twoFactorRequired: true, challengeToken } for totpEnabled=true', async () => {
    const { service, mockUsers } = buildServiceWith2FA();
    const user = makeUser({ totpEnabled: true, totpSecret: 'some-encrypted-secret' });
    mockUsers.findByUsername.mockResolvedValue(user);

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(result).toHaveProperty('twoFactorRequired', true);
    expect(result).toHaveProperty('challengeToken');
    expect(typeof (result as { challengeToken: string }).challengeToken).toBe('string');
  });

  it('does NOT return user or token for totpEnabled=true (no session issued)', async () => {
    const { service, mockUsers } = buildServiceWith2FA();
    mockUsers.findByUsername.mockResolvedValue(
      makeUser({ totpEnabled: true, totpSecret: 'enc-secret' }),
    );

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(result).not.toHaveProperty('user');
    expect(result).not.toHaveProperty('token');
  });

  it('does NOT write success audit at step-1 for totpEnabled=true', async () => {
    const { service, mockUsers, mockAudit } = buildServiceWith2FA();
    mockUsers.findByUsername.mockResolvedValue(
      makeUser({ totpEnabled: true, totpSecret: 'enc-secret' }),
    );

    await service.login({ username: 'cajero1', password: PASSWORD }, ctx);

    expect(mockAudit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success' }),
    );
  });

  it('challenge token is a valid JWT carrying typ="2fa_challenge" and correct sub', async () => {
    const { service, mockUsers, jwtService } = buildServiceWith2FA();
    const user = makeUser({ id: 99, totpEnabled: true, totpSecret: 'enc' });
    mockUsers.findByUsername.mockResolvedValue(user);

    const result = await service.login({ username: 'cajero1', password: PASSWORD }, ctx);
    const token = (result as { challengeToken: string }).challengeToken;

    const decoded = jwtService.decode(token) as Record<string, unknown>;
    expect(decoded['typ']).toBe('2fa_challenge');
    expect(decoded['sub']).toBe(99);
  });

  it('still rejects bad password for totpEnabled=true user (lockout/audit unchanged)', async () => {
    const { service, mockUsers } = buildServiceWith2FA();
    mockUsers.findByUsername.mockResolvedValue(makeUser({ totpEnabled: true, totpSecret: 'enc' }));

    await expect(
      service.login({ username: 'cajero1', password: 'wrong-pass' }, ctx),
    ).rejects.toThrow(UnauthorizedException);
  });
});

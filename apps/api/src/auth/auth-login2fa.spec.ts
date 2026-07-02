/**
 * T-login2fa — AuthService.login2fa + POST /auth/login/2fa (CP-12 / PR-a2).
 *
 * Verifies step-2 of the two-factor login flow:
 *   - Lockout re-check before code verification (locked → 429 before any TOTP call)
 *   - Valid challengeToken + valid code → AuthResult (user + token) + success audit
 *   - Valid challengeToken + invalid code → failure/bad_totp audit + UnauthorizedException
 *   - Expired challengeToken → UnauthorizedException (no session)
 *   - Wrong-typ token (session token used as challenge) → UnauthorizedException
 *   - Repeated bad_totp failures count toward CP-02 lockout (audit reason='bad_totp')
 *   - Controller adds POST /auth/login/2fa endpoint that accepts Login2faInput schema
 */
import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginAuditService } from './login-audit.service';
import { LockoutService } from './lockout.service';
import { AlertService } from './alert.service';
import { TooManyAttemptsException } from './too-many-attempts.exception';
import { TotpService } from './totp.service';
import { TotpCryptoService } from './totp-crypto.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';

const JWT_SECRET = 'login2fa-test-secret';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 7;
  user.username = 'admin1';
  user.passwordHash = '$2b$04$FAKE';
  user.isActive = true;
  user.isSystem = false;
  user.role = Role.Admin;
  user.totpEnabled = true;
  user.totpSecret = 'v1:encrypted-envelope';
  user.profile = { id: 1, firstName: 'A', lastName: 'B' } as any;
  return Object.assign(user, overrides);
}

function buildService(opts: {
  lockout?: { isLocked: boolean; failureCount: number };
  totpValid?: boolean;
  user?: User | null;
}): {
  service: AuthService;
  mockUsers: { findByUsername: jest.Mock; findById: jest.Mock };
  mockAudit: { record: jest.Mock };
  mockLockout: { isLocked: jest.Mock };
  mockTotpSvc: { verify: jest.Mock };
  mockTotpCrypto: { decrypt: jest.Mock };
  jwtService: JwtService;
} {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.TOTP_CHALLENGE_EXPIRES = '5m';

  const jwtService = new JwtService({ secret: JWT_SECRET });
  const mockUsers = {
    findByUsername: jest.fn(),
    findById: jest.fn().mockResolvedValue(opts.user ?? makeUser()),
  };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
  const mockLockout = {
    isLocked: jest.fn().mockResolvedValue(opts.lockout ?? { isLocked: false, failureCount: 0 }),
  };
  const mockAlert = { emit: jest.fn().mockResolvedValue(undefined) };

  const mockTotpSvc = {
    verify: jest.fn().mockReturnValue(opts.totpValid ?? true),
  } as unknown as TotpService;
  const mockTotpCrypto = {
    decrypt: jest.fn().mockReturnValue('PLAINB32SECRET'),
  } as unknown as TotpCryptoService;

  const service = new AuthService(
    mockUsers as unknown as UsersService,
    jwtService,
    mockAudit as unknown as LoginAuditService,
    mockLockout as unknown as LockoutService,
    mockAlert as unknown as AlertService,
    mockTotpSvc,
    mockTotpCrypto,
  );

  return {
    service,
    mockUsers,
    mockAudit,
    mockLockout,
    mockTotpSvc: mockTotpSvc as unknown as { verify: jest.Mock },
    mockTotpCrypto: mockTotpCrypto as unknown as { decrypt: jest.Mock },
    jwtService,
  };
}

function signChallenge(
  jwtService: JwtService,
  userId: number,
  opts?: { typ?: string; expiresIn?: number },
): string {
  const { typ = '2fa_challenge', expiresIn = 300 } = opts ?? {}; // default 5m = 300s
  return jwtService.sign({ sub: userId, typ }, { expiresIn });
}

const ctx = { ip: '127.0.0.1', userAgent: 'Jest/1.0' };

// ─── Lockout re-check at step-2 ──────────────────────────────────────────────

describe('AuthService.login2fa — lockout re-check at step-2 (T-login2fa-lockout)', () => {
  it('throws TooManyAttemptsException (429) when the user is locked at step-2 start', async () => {
    const { service, jwtService } = buildService({
      lockout: { isLocked: true, failureCount: 5 },
    });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '123456' }, ctx)).rejects.toThrow(
      TooManyAttemptsException,
    );
  });

  it('does NOT call TotpService.verify when locked', async () => {
    const { service, jwtService, mockTotpSvc } = buildService({
      lockout: { isLocked: true, failureCount: 5 },
    });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '123456' }, ctx)).rejects.toThrow(
      TooManyAttemptsException,
    );

    expect(mockTotpSvc.verify).not.toHaveBeenCalled();
  });
});

// ─── Valid code → session ─────────────────────────────────────────────────────

describe('AuthService.login2fa — valid code (T-login2fa-valid)', () => {
  it('returns { user, token } on valid challenge + valid code', async () => {
    const { service, jwtService } = buildService({ totpValid: true });
    const token = signChallenge(jwtService, 7);

    const result = await service.login2fa({ challengeToken: token, code: '123456' }, ctx);

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
  });

  it('writes outcome=success audit on valid code', async () => {
    const { service, jwtService, mockAudit } = buildService({ totpValid: true });
    const token = signChallenge(jwtService, 7);

    await service.login2fa({ challengeToken: token, code: '123456' }, ctx);

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', reason: null }),
    );
  });

  it('decrypts the stored secret and passes plaintext to TotpService.verify', async () => {
    const { service, jwtService, mockTotpSvc, mockTotpCrypto } = buildService({ totpValid: true });
    const token = signChallenge(jwtService, 7);

    await service.login2fa({ challengeToken: token, code: '999999' }, ctx);

    expect(mockTotpCrypto.decrypt).toHaveBeenCalled();
    expect(mockTotpSvc.verify).toHaveBeenCalledWith('999999', 'PLAINB32SECRET');
  });
});

// ─── Invalid code → failure + bad_totp ───────────────────────────────────────

describe('AuthService.login2fa — invalid code (T-login2fa-invalid)', () => {
  it('throws UnauthorizedException on invalid TOTP code', async () => {
    const { service, jwtService } = buildService({ totpValid: false });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '000000' }, ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('writes outcome=failure reason=bad_totp audit on invalid code', async () => {
    const { service, jwtService, mockAudit } = buildService({ totpValid: false });
    const user = makeUser({ id: 7, username: 'admin1' });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '000000' }, ctx)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'bad_totp',
        userId: user.id,
      }),
    );
  });

  it('does NOT issue a session (no user/token) on invalid code', async () => {
    const { service, jwtService } = buildService({ totpValid: false });
    const token = signChallenge(jwtService, 7);

    const p = service.login2fa({ challengeToken: token, code: '000000' }, ctx);
    await expect(p).rejects.toThrow(UnauthorizedException);
  });
});

// ─── Expired / invalid challenge token ───────────────────────────────────────

describe('AuthService.login2fa — bad challenge token (T-login2fa-bad-token)', () => {
  it('throws UnauthorizedException for an expired challenge token', async () => {
    const { service, jwtService } = buildService({});
    const expired = jwtService.sign({ sub: 7, typ: '2fa_challenge' }, { expiresIn: 0 }); // 0s = immediately expired

    await expect(
      service.login2fa({ challengeToken: expired, code: '123456' }, ctx),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a normal session token used as challenge', async () => {
    const { service, jwtService } = buildService({});
    // Token without typ:'2fa_challenge' — a normal session token must not be usable at step 2
    const sessionToken = jwtService.sign({ sub: 7, username: 'admin1', role: 'admin' });

    await expect(
      service.login2fa({ challengeToken: sessionToken, code: '123456' }, ctx),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a garbage string', async () => {
    const { service } = buildService({});

    await expect(
      service.login2fa({ challengeToken: 'not.a.valid.token', code: '123456' }, ctx),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── Lockout interplay: bad_totp rows count toward CP-02 ─────────────────────

describe('AuthService.login2fa — lockout interplay (T-login2fa-lockout-interplay)', () => {
  it('bad_totp audit row has outcome=failure (so CP-02 sliding-window counts it)', async () => {
    const { service, jwtService, mockAudit } = buildService({ totpValid: false });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '111111' }, ctx)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'bad_totp' }),
    );
  });

  it('writes username in the audit row so CP-02 isLocked can count by username', async () => {
    const { service, jwtService, mockAudit } = buildService({ totpValid: false });
    const token = signChallenge(jwtService, 7);

    await expect(service.login2fa({ challengeToken: token, code: '222222' }, ctx)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'admin1', outcome: 'failure' }),
    );
  });
});

// ─── Controller route: POST /auth/login/2fa ──────────────────────────────────

type AnyHandler = (...args: unknown[]) => unknown;

describe('AuthController — POST /auth/login/2fa route (T-login2fa-controller)', () => {
  it('registers a handler for POST /auth/login/2fa', () => {
    const proto = AuthController.prototype;
    const handler = proto['login2fa'] as AnyHandler | undefined;
    expect(handler).toBeDefined();

    const path = Reflect.getMetadata(PATH_METADATA, handler!) as string;
    const method = Reflect.getMetadata(METHOD_METADATA, handler!) as number;

    expect(path).toBe('login/2fa');
    expect(method).toBe(RequestMethod.POST);
  });
});

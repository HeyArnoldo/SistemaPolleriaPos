/**
 * T-challenge-token — AuthService challenge token helpers (CP-12 / PR-a2).
 *
 * Verifies:
 *   - signChallengeToken returns a signed JWT with typ:'2fa_challenge' and correct sub.
 *   - verifyChallengeToken returns the userId for a valid unexpired token.
 *   - verifyChallengeToken throws UnauthorizedException for expired token.
 *   - verifyChallengeToken throws UnauthorizedException when typ is not '2fa_challenge'.
 *   - verifyChallengeToken throws UnauthorizedException for a malformed/garbage token.
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginAuditService } from './login-audit.service';
import { LockoutService } from './lockout.service';
import { AlertService } from './alert.service';
import { UsersService } from '../users/users.service';
import { TotpService } from './totp.service';
import { TotpCryptoService } from './totp-crypto.service';

const JWT_SECRET = 'test-secret-for-challenge-token-tests';

function buildService(): {
  service: AuthService;
  jwtService: JwtService;
} {
  const jwtService = new JwtService({ secret: JWT_SECRET });
  const mockUsers = { findByUsername: jest.fn(), findById: jest.fn() };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
  const mockLockout = {
    isLocked: jest.fn().mockResolvedValue({ isLocked: false, failureCount: 0 }),
  };
  const mockAlert = { emit: jest.fn().mockResolvedValue(undefined) };
  const mockTotpSvc = { verify: jest.fn() } as unknown as TotpService;
  const mockTotpCrypto = { decrypt: jest.fn() } as unknown as TotpCryptoService;

  // Set JWT_SECRET for the service
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.TOTP_CHALLENGE_EXPIRES = '5m';

  const service = new AuthService(
    mockUsers as unknown as UsersService,
    jwtService,
    mockAudit as unknown as LoginAuditService,
    mockLockout as unknown as LockoutService,
    mockAlert as unknown as AlertService,
    mockTotpSvc,
    mockTotpCrypto,
  );

  return { service, jwtService };
}

describe('AuthService — challenge token (T-challenge-token)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.TOTP_CHALLENGE_EXPIRES = '5m';
  });

  it('signChallengeToken returns a string (JWT)', () => {
    const { service } = buildService();
    const token = service.signChallengeToken(42);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyChallengeToken returns userId for a valid challenge token', () => {
    const { service } = buildService();
    const token = service.signChallengeToken(42);
    const userId = service.verifyChallengeToken(token);
    expect(userId).toBe(42);
  });

  it('signed token carries typ="2fa_challenge" in the payload', () => {
    const { service, jwtService } = buildService();
    const token = service.signChallengeToken(7);
    const decoded = jwtService.decode(token) as Record<string, unknown>;
    expect(decoded['typ']).toBe('2fa_challenge');
    expect(decoded['sub']).toBe(7);
  });

  it('verifyChallengeToken throws UnauthorizedException for a regular session token (no typ)', () => {
    const { service, jwtService } = buildService();
    const sessionToken = jwtService.sign(
      { sub: 7, username: 'admin1', role: 'admin' },
      { expiresIn: 300 }, // 5 minutes in seconds
    );
    expect(() => service.verifyChallengeToken(sessionToken)).toThrow(UnauthorizedException);
  });

  it('verifyChallengeToken throws UnauthorizedException for a garbage string', () => {
    const { service } = buildService();
    expect(() => service.verifyChallengeToken('not.a.token')).toThrow(UnauthorizedException);
  });

  it('verifyChallengeToken throws UnauthorizedException for an expired challenge token', () => {
    const { service, jwtService } = buildService();
    // Sign with already-expired TTL (0 seconds = immediately expired)
    const expired = jwtService.sign({ sub: 5, typ: '2fa_challenge' }, { expiresIn: 0 });
    expect(() => service.verifyChallengeToken(expired)).toThrow(UnauthorizedException);
  });
});

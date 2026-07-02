/**
 * T-TOTP-5 — TOTP enrollment endpoints: POST /auth/2fa/enroll and /enroll/confirm.
 * Tests controller behavior via mock services. RED → GREEN → REFACTOR.
 *
 * Invariants:
 * - sistema user (isSystem=true) is always rejected with 403.
 * - Without TOTP_ENCRYPTION_KEY → 503.
 * - enroll: generates secret, stores encrypted, totpEnabled stays false, returns URI + secret.
 * - confirm: valid code → totpEnabled=true; invalid code → 400.
 */
import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TotpCryptoService } from './totp-crypto.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import { TOTP, Secret } from 'otpauth';

// ─── helpers ────────────────────────────────────────────────────────────────

const VALID_KEY = Buffer.alloc(32, 0xab).toString('base64');

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 42;
  user.username = 'admin1';
  user.role = Role.Admin;
  user.isActive = true;
  user.isSystem = false;
  user.totpEnabled = false;
  user.totpSecret = null;
  user.passwordHash = 'hash';
  user.profile = { id: 1, firstName: 'Admin', lastName: 'User', avatarUrl: null } as any;
  user.createdAt = new Date();
  user.updatedAt = new Date();
  return Object.assign(user, overrides);
}

function liveCode(base32Secret: string): string {
  return new TOTP({
    secret: Secret.fromBase32(base32Secret),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  }).generate();
}

function buildController(cryptoKey?: string) {
  const origKey = process.env.TOTP_ENCRYPTION_KEY;
  if (cryptoKey !== undefined) {
    process.env.TOTP_ENCRYPTION_KEY = cryptoKey;
  } else {
    delete process.env.TOTP_ENCRYPTION_KEY;
  }

  const cryptoSvc = cryptoKey ? new TotpCryptoService() : null;
  process.env.TOTP_ENCRYPTION_KEY = origKey;

  const totpSvc = new TotpService();

  const savedUser: { totpSecret?: string | null; totpEnabled?: boolean } = {};

  const mockAuth = {
    login: jest.fn(),
  };
  const mockAudit = { list: jest.fn() };
  const mockUsers: Partial<UsersService> = {
    findOne: jest.fn().mockImplementation(async (id: number) => {
      const u = makeUser({ id });
      if (savedUser.totpSecret !== undefined) u.totpSecret = savedUser.totpSecret;
      if (savedUser.totpEnabled !== undefined) u.totpEnabled = savedUser.totpEnabled;
      return u;
    }),
    update: jest.fn().mockImplementation(async (_id: number, dto: Record<string, unknown>) => {
      if ('totpSecret' in dto) savedUser.totpSecret = dto.totpSecret as string | null;
      if ('totpEnabled' in dto) savedUser.totpEnabled = dto.totpEnabled as boolean;
      const u = makeUser();
      if (savedUser.totpSecret !== undefined) u.totpSecret = savedUser.totpSecret;
      if (savedUser.totpEnabled !== undefined) u.totpEnabled = savedUser.totpEnabled;
      return u;
    }),
  };

  const controller = new AuthController(
    mockAuth as any,
    mockAudit as any,
    cryptoSvc,
    totpSvc,
    mockUsers as any,
  );
  return { controller, mockUsers, savedUser };
}

// ─── POST /auth/2fa/enroll ────────────────────────────────────────────────────

describe('AuthController POST /auth/2fa/enroll (T-TOTP-5a)', () => {
  it('returns { otpauthUri, secret } and stores encrypted secret', async () => {
    const { controller, savedUser } = buildController(VALID_KEY);
    const currentUser = makeUser();

    const result = await controller.enroll(currentUser);

    expect(result).toHaveProperty('otpauthUri');
    expect(result.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(result).toHaveProperty('secret');
    expect(result.secret).toMatch(/^[A-Z2-7]+=*$/); // base32
    // secret stored encrypted (not the raw base32)
    expect(savedUser.totpSecret).toMatch(/^v1:/);
    // totpEnabled stays false until confirm
    expect(savedUser.totpEnabled).toBeFalsy();
  });

  it('rejects sistema user with ForbiddenException', async () => {
    const { controller } = buildController(VALID_KEY);
    const sistemaUser = makeUser({ isSystem: true, username: 'sistema' });

    await expect(controller.enroll(sistemaUser)).rejects.toThrow(ForbiddenException);
  });

  it('returns 503 when TOTP_ENCRYPTION_KEY is absent', async () => {
    const { controller } = buildController(undefined);
    const user = makeUser();

    await expect(controller.enroll(user)).rejects.toThrow(ServiceUnavailableException);
  });
});

// ─── POST /auth/2fa/enroll/confirm ───────────────────────────────────────────

describe('AuthController POST /auth/2fa/enroll/confirm (T-TOTP-5b)', () => {
  it('sets totpEnabled=true when a valid code is submitted', async () => {
    const { controller, savedUser } = buildController(VALID_KEY);
    const currentUser = makeUser();

    // First enroll to store the secret
    const { secret } = await controller.enroll(currentUser);
    const code = liveCode(secret);

    const result = await controller.confirmEnroll(currentUser, { code });

    expect(result).toEqual({ enabled: true });
    expect(savedUser.totpEnabled).toBe(true);
  });

  it('returns 400 and leaves totpEnabled=false on invalid code', async () => {
    const { controller, savedUser } = buildController(VALID_KEY);
    const currentUser = makeUser();

    await controller.enroll(currentUser);

    await expect(controller.confirmEnroll(currentUser, { code: '000000' })).rejects.toThrow(
      BadRequestException,
    );
    expect(savedUser.totpEnabled).toBeFalsy();
  });

  it('rejects sistema user with ForbiddenException', async () => {
    const { controller } = buildController(VALID_KEY);
    const sistemaUser = makeUser({ isSystem: true, username: 'sistema' });

    await expect(controller.confirmEnroll(sistemaUser, { code: '123456' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns 503 when TOTP_ENCRYPTION_KEY is absent', async () => {
    const { controller } = buildController(undefined);
    const user = makeUser();

    await expect(controller.confirmEnroll(user, { code: '123456' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

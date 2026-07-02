/**
 * T-TOTP-4 — Safe serialization: totpSecret NEVER appears in API responses.
 * Covers toSafeUser (AuthController) and stripPasswordHash (UsersController).
 */
import 'reflect-metadata';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { LoginAuditService } from '../auth/login-audit.service';
import { TotpService } from '../auth/totp.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 1;
  user.username = 'admin1';
  user.role = Role.Admin;
  user.isActive = true;
  user.isSystem = false;
  user.totpEnabled = true;
  user.totpSecret = 'v1:someIv:someTag:someCt'; // sensitive — must never leave the API
  user.passwordHash = 'bcrypt-hash';
  user.profile = { id: 1, firstName: 'Admin', lastName: 'User', avatarUrl: null } as any;
  user.createdAt = new Date();
  user.updatedAt = new Date();
  return Object.assign(user, overrides);
}

// ─── toSafeUser (AuthController) ─────────────────────────────────────────────

describe('AuthController.toSafeUser — serialization (T-TOTP-4a)', () => {
  function buildController() {
    const user = makeUser();
    const mockAuth = {
      login: jest.fn().mockResolvedValue({ user, token: 'jwt-token' }),
    };
    const mockAudit = { list: jest.fn() };
    return {
      controller: new AuthController(
        mockAuth as unknown as AuthService,
        mockAudit as unknown as LoginAuditService,
        null,
        new TotpService(),
        null as unknown as UsersService,
      ),
      user,
    };
  }

  it('login response does NOT contain totpSecret', async () => {
    const { controller } = buildController();
    const fakeReq = { ip: '1.1.1.1', headers: { 'user-agent': 'Test' } };
    const fakeRes = { cookie: jest.fn() };
    const result = await controller.login(
      { username: 'a', password: 'b' } as any,
      fakeReq as any,
      fakeRes as any,
    );
    expect(result).not.toHaveProperty('totpSecret');
    expect(JSON.stringify(result)).not.toContain('v1:someIv');
  });

  it('login response does NOT contain passwordHash', async () => {
    const { controller } = buildController();
    const fakeReq = { ip: '1.1.1.1', headers: { 'user-agent': 'Test' } };
    const fakeRes = { cookie: jest.fn() };
    const result = await controller.login(
      { username: 'a', password: 'b' } as any,
      fakeReq as any,
      fakeRes as any,
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('login response MAY expose totpEnabled boolean', async () => {
    const { controller } = buildController();
    const fakeReq = { ip: '1.1.1.1', headers: { 'user-agent': 'Test' } };
    const fakeRes = { cookie: jest.fn() };
    const result = await controller.login(
      { username: 'a', password: 'b' } as any,
      fakeReq as any,
      fakeRes as any,
    );
    // totpEnabled is acceptable (a boolean flag, not a secret)
    if ('totpEnabled' in result) {
      expect(typeof result.totpEnabled).toBe('boolean');
    }
  });
});

// ─── stripPasswordHash (UsersController) ─────────────────────────────────────

describe('UsersController.stripPasswordHash — serialization (T-TOTP-4b)', () => {
  function buildController() {
    const user = makeUser();
    const mockUsers = {
      findAll: jest.fn().mockResolvedValue([user]),
      create: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    };
    return {
      controller: new UsersController(mockUsers as unknown as UsersService),
      user,
    };
  }

  it('GET /users does NOT expose totpSecret in any user', async () => {
    const { controller } = buildController();
    const results = await controller.listUsers();
    for (const u of results) {
      expect(u).not.toHaveProperty('totpSecret');
      expect(JSON.stringify(u)).not.toContain('v1:someIv');
    }
  });

  it('GET /users does NOT expose passwordHash in any user', async () => {
    const { controller } = buildController();
    const results = await controller.listUsers();
    for (const u of results) {
      expect(u).not.toHaveProperty('passwordHash');
    }
  });
});

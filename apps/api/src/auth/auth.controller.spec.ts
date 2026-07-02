/**
 * T4.1 / T4.2 — AuthController login audit wiring + admin read endpoint.
 * T4.1: POST /login forwards { ip, userAgent } from request into auth.login; response unchanged.
 * T4.2: GET /auth/login-audit is guarded by JwtAuthGuard + RolesGuard + @Roles(Admin),
 *        returns paginated rows for admin, rejects non-admin.
 */
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService, LoginContext } from './auth.service';
import { LoginAuditService } from './login-audit.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 1;
  user.username = 'admin1';
  user.role = Role.Admin;
  user.isActive = true;
  user.profile = { id: 1, firstName: 'Admin', lastName: 'User' } as any;
  return Object.assign(user, overrides);
}

function buildController(): {
  controller: AuthController;
  mockAuth: { login: jest.Mock };
  mockAudit: { list: jest.Mock };
} {
  const mockAuth = {
    login: jest.fn().mockResolvedValue({ user: makeUser(), token: 'jwt-token' }),
  };
  const mockAudit = {
    list: jest.fn().mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 }),
  };

  const controller = new AuthController(
    mockAuth as unknown as AuthService,
    mockAudit as unknown as LoginAuditService,
  );

  return { controller, mockAuth, mockAudit };
}

// ─── T4.1: POST /login context capture ────────────────────────────────────────

describe('AuthController.login — context capture (T4.1)', () => {
  it('forwards ip and userAgent from request into auth.login', async () => {
    const { controller, mockAuth } = buildController();

    const fakeReq = {
      ip: '10.0.0.1',
      headers: { 'user-agent': 'TestBrowser/2.0' },
    };
    const fakeRes = { cookie: jest.fn() };
    const input = { username: 'cajero1', password: 'pass' };

    await controller.login(input as any, fakeReq as any, fakeRes as any);

    const callArgs = mockAuth.login.mock.calls[0] as [unknown, LoginContext];
    expect(callArgs[1]).toEqual({ ip: '10.0.0.1', userAgent: 'TestBrowser/2.0' });
  });

  it('login response is unchanged — returns user shape (no token exposed)', async () => {
    const { controller, mockAuth } = buildController();
    const user = makeUser();
    mockAuth.login.mockResolvedValue({ user, token: 'jwt-token' });

    const fakeReq = { ip: '1.2.3.4', headers: { 'user-agent': 'Chrome' } };
    const fakeRes = { cookie: jest.fn() };

    const result = await controller.login(
      { username: 'a', password: 'b' } as any,
      fakeReq as any,
      fakeRes as any,
    );

    // token must NOT be in the response body; user fields must be present
    expect(result).not.toHaveProperty('token');
    expect(result).toHaveProperty('id', user.id);
    expect(result).toHaveProperty('username', user.username);
  });

  it('sets the session cookie on login', async () => {
    const { controller } = buildController();
    const fakeReq = { ip: '1.2.3.4', headers: { 'user-agent': 'Chrome' } };
    const fakeRes = { cookie: jest.fn() };

    await controller.login({ username: 'a', password: 'b' } as any, fakeReq as any, fakeRes as any);

    expect(fakeRes.cookie).toHaveBeenCalled();
  });
});

// ─── T4.2: GET /auth/login-audit guard + response ─────────────────────────────

describe('AuthController GET /auth/login-audit — guard metadata (T4.2)', () => {
  it('route exists on the controller at path "login-audit"', () => {
    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function | undefined;
    expect(handler).toBeDefined();
    const path = Reflect.getMetadata(PATH_METADATA, handler!) as string;
    expect(path).toBe('login-audit');
  });

  it('is a GET endpoint', () => {
    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as number;
    expect(method).toBe(RequestMethod.GET);
  });

  it('requires Admin role via @Roles decorator', () => {
    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function;
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
    expect(roles).toContain(Role.Admin);
  });

  it('has JwtAuthGuard and RolesGuard in @UseGuards', () => {
    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as Function[];
    const guardNames = guards.map((g) => g.name);
    expect(guardNames).toContain('JwtAuthGuard');
    expect(guardNames).toContain('RolesGuard');
  });

  it('returns paginated data from LoginAuditService.list', async () => {
    const { controller, mockAudit } = buildController();
    const page = {
      data: [new (require('./entities/login-audit.entity').LoginAudit)()],
      page: 1,
      limit: 20,
      total: 1,
    };
    mockAudit.list.mockResolvedValue(page);

    const result = await controller.listLoginAudit({ page: 1, limit: 20 } as any);

    expect(mockAudit.list).toHaveBeenCalledWith(1, 20);
    expect(result).toEqual(page);
  });

  it('uses default page=1, limit=20 when no params', async () => {
    const { controller, mockAudit } = buildController();
    mockAudit.list.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });

    // Simulate what ZodValidationPipe produces after applying defaults
    await controller.listLoginAudit({ page: 1, limit: 20 } as any);

    expect(mockAudit.list).toHaveBeenCalledWith(1, 20);
  });

  it('rejects cashier with ForbiddenException via RolesGuard', () => {
    const cashier = makeUser({ role: Role.Cashier });
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    // Simulate execution context where handler has @Roles(Admin)
    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function;
    const mockCtx = {
      getHandler: () => handler,
      getClass: () => AuthController,
      switchToHttp: () => ({ getRequest: () => ({ user: cashier }) }),
    } as any;

    expect(() => guard.canActivate(mockCtx)).toThrow(ForbiddenException);
  });

  it('allows Admin via RolesGuard', () => {
    const admin = makeUser({ role: Role.Admin });
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    const proto = AuthController.prototype;
    const handler = proto['listLoginAudit'] as Function;
    const mockCtx = {
      getHandler: () => handler,
      getClass: () => AuthController,
      switchToHttp: () => ({ getRequest: () => ({ user: admin }) }),
    } as any;

    expect(guard.canActivate(mockCtx)).toBe(true);
  });
});

// ─── Route contract: login-audit must appear in route set ─────────────────────

describe('AuthController route contract', () => {
  it('registers GET /auth/login-audit', () => {
    const base = (Reflect.getMetadata(PATH_METADATA, AuthController) as string) ?? '';
    const proto = AuthController.prototype;
    const routes = new Set<string>();
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name as keyof typeof proto];
      if (typeof handler !== 'function') continue;
      const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (methodPath === undefined) continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number;
      const VERB: Record<number, string> = {
        [RequestMethod.GET]: 'GET',
        [RequestMethod.POST]: 'POST',
      };
      routes.add(`${VERB[method]} /${base}/${methodPath}`.replace(/\/+/g, '/'));
    }
    expect(routes).toContain('GET /auth/login-audit');
  });
});

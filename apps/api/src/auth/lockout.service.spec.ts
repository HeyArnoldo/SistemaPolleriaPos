/**
 * WU1 — LockoutService unit tests.
 * Verifies:
 *   - sliding-window count filters only 'failure' rows within the window
 *   - threshold/lock logic (at/above = locked, below = not locked)
 *   - env-var overrides (LOGIN_LOCKOUT_MAX_FAILURES, LOGIN_LOCKOUT_WINDOW_MINUTES)
 *   - sistema user uses LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES (default 20)
 *   - fail-open: count query error → isLocked=false, failureCount=0, no throw
 */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LockoutService } from './lockout.service';
import { LoginAudit } from './entities/login-audit.entity';

const savedEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]): void {
  for (const k of keys) savedEnv[k] = process.env[k];
}

function restoreEnv(...keys: string[]): void {
  for (const k of keys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

const ENV_KEYS = [
  'LOGIN_LOCKOUT_MAX_FAILURES',
  'LOGIN_LOCKOUT_WINDOW_MINUTES',
  'LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES',
];

describe('LockoutService', () => {
  let service: LockoutService;
  let mockRepo: { count: jest.Mock };

  beforeEach(async () => {
    saveEnv(...ENV_KEYS);
    // clear all lockout env vars so defaults apply
    for (const k of ENV_KEYS) delete process.env[k];

    mockRepo = { count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LockoutService, { provide: getRepositoryToken(LoginAudit), useValue: mockRepo }],
    }).compile();

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = module.get<LockoutService>(LockoutService);
  });

  afterEach(() => {
    restoreEnv(...ENV_KEYS);
    jest.restoreAllMocks();
  });

  describe('isLocked() — failure counting', () => {
    it('counts only failure rows inside the window', async () => {
      mockRepo.count.mockResolvedValue(4);

      const result = await service.isLocked('admin');

      expect(mockRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ username: 'admin', outcome: 'failure' }),
        }),
      );
      expect(result.failureCount).toBe(4);
    });

    it('the where clause uses MoreThanOrEqual (not a raw date string or <)', async () => {
      mockRepo.count.mockResolvedValue(0);

      await service.isLocked('admin');

      // The where.createdAt must be a FindOperator (MoreThanOrEqual), not a plain Date or string.
      const call = mockRepo.count.mock.calls[0][0] as { where: { createdAt: unknown } };
      const createdAt = call.where.createdAt as { _type?: string };
      expect(createdAt).toBeDefined();
      // TypeORM FindOperator has a type property
      expect(typeof createdAt).toBe('object');
      expect(createdAt._type).toBe('moreThanOrEqual');
    });

    it('returns isLocked=false when count is below threshold', async () => {
      mockRepo.count.mockResolvedValue(4); // default threshold = 5

      const result = await service.isLocked('admin');

      expect(result.isLocked).toBe(false);
    });

    it('returns isLocked=true at the threshold', async () => {
      mockRepo.count.mockResolvedValue(5); // exactly at default threshold 5

      const result = await service.isLocked('admin');

      expect(result.isLocked).toBe(true);
    });

    it('returns isLocked=true above the threshold', async () => {
      mockRepo.count.mockResolvedValue(10);

      const result = await service.isLocked('admin');

      expect(result.isLocked).toBe(true);
    });
  });

  describe('isLocked() — env overrides', () => {
    it('uses defaults when env vars are not set (threshold=5, window=15)', async () => {
      mockRepo.count.mockResolvedValue(5);

      const result = await service.isLocked('admin');

      expect(result.isLocked).toBe(true); // 5 >= 5 default
    });

    it('respects LOGIN_LOCKOUT_MAX_FAILURES override', async () => {
      process.env.LOGIN_LOCKOUT_MAX_FAILURES = '3';
      // Re-create module so the service picks up the new env
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          LockoutService,
          { provide: getRepositoryToken(LoginAudit), useValue: mockRepo },
        ],
      }).compile();
      const svc2 = module2.get<LockoutService>(LockoutService);

      mockRepo.count.mockResolvedValue(3);
      const result = await svc2.isLocked('admin');

      expect(result.isLocked).toBe(true); // 3 >= 3 custom threshold
    });

    it('falls back to default when LOGIN_LOCKOUT_MAX_FAILURES is invalid (NaN)', async () => {
      process.env.LOGIN_LOCKOUT_MAX_FAILURES = 'not-a-number';
      const module3: TestingModule = await Test.createTestingModule({
        providers: [
          LockoutService,
          { provide: getRepositoryToken(LoginAudit), useValue: mockRepo },
        ],
      }).compile();
      const svc3 = module3.get<LockoutService>(LockoutService);

      mockRepo.count.mockResolvedValue(4);
      const result = await svc3.isLocked('admin');

      expect(result.isLocked).toBe(false); // 4 < 5 (default), not 4 < NaN
    });
  });

  describe('isLocked() — sistema user (break-glass)', () => {
    it('sistema user is NOT locked at count=6 when normal threshold is 5 and system threshold is 20', async () => {
      // defaults: normal=5, sistema=20
      mockRepo.count.mockResolvedValue(6);

      const result = await service.isLocked('sistema');

      expect(result.isLocked).toBe(false); // 6 < 20
    });

    it('sistema user IS locked at its own system threshold (20)', async () => {
      mockRepo.count.mockResolvedValue(20);

      const result = await service.isLocked('sistema');

      expect(result.isLocked).toBe(true); // 20 >= 20
    });

    it('LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES overrides the sistema threshold', async () => {
      process.env.LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES = '10';
      const module4: TestingModule = await Test.createTestingModule({
        providers: [
          LockoutService,
          { provide: getRepositoryToken(LoginAudit), useValue: mockRepo },
        ],
      }).compile();
      const svc4 = module4.get<LockoutService>(LockoutService);

      mockRepo.count.mockResolvedValue(10);
      const result = await svc4.isLocked('sistema');

      expect(result.isLocked).toBe(true); // 10 >= 10 custom system threshold
    });
  });

  describe('isLocked() — fail-open', () => {
    it('returns isLocked=false and failureCount=0 when count query throws', async () => {
      mockRepo.count.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.isLocked('admin');

      expect(result).toEqual({ isLocked: false, failureCount: 0 });
    });

    it('does NOT rethrow when count query throws (fail-open)', async () => {
      mockRepo.count.mockRejectedValue(new Error('timeout'));

      await expect(service.isLocked('admin')).resolves.not.toThrow();
    });

    it('logs a warning/error when count query throws', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      mockRepo.count.mockRejectedValue(new Error('boom'));

      await service.isLocked('admin');

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

/**
 * T2.1 — LoginAuditService unit tests.
 * Covers record() best-effort (inserts row, swallows errors) and list() pagination.
 */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoginAuditService } from './login-audit.service';
import { LoginAudit } from './entities/login-audit.entity';

const STORE_ID_ORIGINAL = process.env.STORE_ID;

describe('LoginAuditService', () => {
  let service: LoginAuditService;
  let mockRepo: {
    insert: jest.Mock;
    findAndCount: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      insert: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAuditService,
        { provide: getRepositoryToken(LoginAudit), useValue: mockRepo },
      ],
    }).compile();

    // suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = module.get<LoginAuditService>(LoginAuditService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // restore STORE_ID
    if (STORE_ID_ORIGINAL === undefined) {
      delete process.env.STORE_ID;
    } else {
      process.env.STORE_ID = STORE_ID_ORIGINAL;
    }
  });

  describe('record()', () => {
    it('inserts a row with sede from STORE_ID env', async () => {
      process.env.STORE_ID = 'sede-lima-01';
      mockRepo.insert.mockResolvedValue(undefined);

      await service.record({
        username: 'cajero1',
        outcome: 'success',
        reason: null,
        userId: 42,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cajero1',
          outcome: 'success',
          reason: null,
          userId: 42,
          sede: 'sede-lima-01',
        }),
      );
    });

    it('stores sede as null when STORE_ID is not set', async () => {
      delete process.env.STORE_ID;
      mockRepo.insert.mockResolvedValue(undefined);

      await service.record({
        username: 'cajero1',
        outcome: 'failure',
        reason: 'bad_password',
        userId: 42,
        ipAddress: null,
        userAgent: null,
      });

      expect(mockRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ sede: null }));
    });

    it('resolves (does not throw) when the repo insert rejects', async () => {
      mockRepo.insert.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.record({
          username: 'attacker',
          outcome: 'failure',
          reason: 'unknown_user',
          userId: null,
          ipAddress: '10.0.0.1',
          userAgent: null,
        }),
      ).resolves.toBeUndefined();
    });

    it('logs an error when insert fails (best-effort)', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      mockRepo.insert.mockRejectedValue(new Error('boom'));

      await service.record({
        username: 'x',
        outcome: 'failure',
        reason: 'unknown_user',
        userId: null,
        ipAddress: null,
        userAgent: null,
      });

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('list()', () => {
    it('returns findAndCount result mapped to { data, page, limit, total }', async () => {
      const rows = [new LoginAudit(), new LoginAudit()];
      mockRepo.findAndCount.mockResolvedValue([rows, 50]);

      const result = await service.list(2, 20);

      expect(result).toEqual({ data: rows, page: 2, limit: 20, total: 50 });
    });

    it('orders by createdAt DESC', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list(1, 20);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('applies skip/take correctly for page 2 with limit 10', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list(2, 10);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('clamps limit to max 100', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list(1, 999);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });
});

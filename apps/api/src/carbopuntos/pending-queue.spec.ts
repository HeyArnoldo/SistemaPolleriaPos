/**
 * T5.16 — CarbopuntosPendingService tests.
 * Tests: enqueue a failed movement, retry successfully, mark as failed after N attempts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CarbopuntosPendingService } from './pending-queue.service';
import { CarbopuntosPendingMovement } from './entities/pending-movement.entity';
import { CARBOPUNTOS_CLIENT_TOKEN } from './carbopuntos.tokens';
import { CarbopuntosApiError, CarbopuntosUnavailableError } from '@app/carbopuntos-client';

const makePending = (
  overrides?: Partial<CarbopuntosPendingMovement>,
): CarbopuntosPendingMovement => {
  const p = new CarbopuntosPendingMovement();
  p.id = 'uuid-pending-1';
  p.operation = 'accrue';
  p.customerDni = '12345678';
  p.saleRef = 'SALE-001';
  p.points = 10;
  p.idempotencyKey = 'SALE-001:accrue';
  p.userRef = 'cashier';
  p.status = 'pending';
  p.attemptCount = 0;
  p.lastError = null;
  p.nextRetryAt = null;
  p.createdAt = new Date();
  return Object.assign(p, overrides);
};

describe('CarbopuntosPendingService', () => {
  let service: CarbopuntosPendingService;
  let mockClient: { accrue: jest.Mock; reverse: jest.Mock };
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    mockClient = { accrue: jest.fn(), reverse: jest.fn() };
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarbopuntosPendingService,
        { provide: getRepositoryToken(CarbopuntosPendingMovement), useValue: mockRepo },
        { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
      ],
    }).compile();

    service = module.get<CarbopuntosPendingService>(CarbopuntosPendingService);
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('creates a pending movement record with status=pending', async () => {
      const payload = {
        operation: 'accrue' as const,
        customerDni: '12345678',
        saleRef: 'SALE-001',
        points: 10,
        idempotencyKey: 'SALE-001:accrue',
        userRef: 'cashier',
      };
      const pending = makePending();
      mockRepo.create.mockReturnValue(pending);
      mockRepo.save.mockResolvedValue(pending);

      await service.enqueue(payload);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'accrue',
          status: 'pending',
          attemptCount: 0,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('retryPending', () => {
    it('retries a pending accrue movement and marks it as done on success', async () => {
      const pending = makePending({ status: 'pending', attemptCount: 0 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockResolvedValue({ id: 'mov-1' });
      mockRepo.save.mockResolvedValue({ ...pending, status: 'done' });

      await service.retryPending();

      expect(mockClient.accrue).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDni: '12345678',
          points: 10,
          idempotencyKey: 'SALE-001:accrue',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    });

    it('increments attemptCount on failure and keeps status=retrying', async () => {
      const pending = makePending({ status: 'pending', attemptCount: 0 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockRejectedValue(new CarbopuntosUnavailableError('Hub caído'));
      mockRepo.save.mockResolvedValue({ ...pending, status: 'retrying', attemptCount: 1 });

      await service.retryPending();

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retrying',
          attemptCount: 1,
        }),
      );
    });

    it('marks a permanent (4xx) error as failed without consuming retry attempts', async () => {
      // A CarbopuntosApiError is permanent: it will never succeed on retry,
      // so the movement must be marked failed immediately, not retried.
      const pending = makePending({ status: 'pending', attemptCount: 0 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockRejectedValue(
        new CarbopuntosApiError('Saldo insuficiente', 409, { error: 'insufficient' }),
      );
      mockRepo.save.mockImplementation((m: CarbopuntosPendingMovement) => Promise.resolve(m));

      await service.retryPending();

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', attemptCount: 0 }),
      );
    });

    it('retries a transient (5xx) error with backoff instead of marking failed', async () => {
      // A CarbopuntosApiError with status >= 500 is transient: it must be
      // retried (status=retrying, attemptCount incremented), NOT marked failed.
      const pending = makePending({ status: 'pending', attemptCount: 0 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockRejectedValue(
        new CarbopuntosApiError('Bad gateway', 503, { error: 'unavailable' }),
      );
      mockRepo.save.mockImplementation((m: CarbopuntosPendingMovement) => Promise.resolve(m));

      await service.retryPending();

      const saved = mockRepo.save.mock.calls[0][0] as CarbopuntosPendingMovement;
      expect(saved.status).toBe('retrying');
      expect(saved.attemptCount).toBe(1);
      expect(saved.nextRetryAt).toBeInstanceOf(Date);
    });

    it('schedules nextRetryAt in the future on a transient (unavailable) failure', async () => {
      const pending = makePending({ status: 'pending', attemptCount: 0 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockRejectedValue(new CarbopuntosUnavailableError('Hub caído'));
      mockRepo.save.mockImplementation((m: CarbopuntosPendingMovement) => Promise.resolve(m));

      const before = Date.now();
      await service.retryPending();

      const saved = mockRepo.save.mock.calls[0][0] as CarbopuntosPendingMovement;
      expect(saved.status).toBe('retrying');
      expect(saved.nextRetryAt).toBeInstanceOf(Date);
      expect(saved.nextRetryAt!.getTime()).toBeGreaterThan(before);
    });

    it('reuses the stored idempotencyKey on retry (never generates a new one)', async () => {
      const pending = makePending({
        status: 'pending',
        attemptCount: 0,
        idempotencyKey: 'SEDE-01:SALE-001:accrual',
      });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockResolvedValue({ id: 'mov-1' });
      mockRepo.save.mockImplementation((m: CarbopuntosPendingMovement) => Promise.resolve(m));

      await service.retryPending();

      expect(mockClient.accrue).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'SEDE-01:SALE-001:accrual' }),
      );
    });

    it('marks as failed (data error) when a pending movement has no idempotencyKey', async () => {
      const pending = makePending({
        status: 'pending',
        attemptCount: 0,
        idempotencyKey: null,
      });
      mockRepo.find.mockResolvedValue([pending]);
      mockRepo.save.mockImplementation((m: CarbopuntosPendingMovement) => Promise.resolve(m));

      await service.retryPending();

      expect(mockClient.accrue).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });

    it('marks as failed after reaching max attempts', async () => {
      const maxAttempts = 5;
      const pending = makePending({ status: 'retrying', attemptCount: maxAttempts - 1 });
      mockRepo.find.mockResolvedValue([pending]);
      mockClient.accrue.mockRejectedValue(new CarbopuntosUnavailableError('Hub caído'));
      mockRepo.save.mockResolvedValue({ ...pending, status: 'failed', attemptCount: maxAttempts });

      await service.retryPending();

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });
});

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Or, Repository } from 'typeorm';
import { CarbopuntosPendingMovement } from './entities/pending-movement.entity';
import { CARBOPUNTOS_CLIENT_TOKEN } from './carbopuntos.tokens';
import type { CarbopuntosClient } from '@app/carbopuntos-client';
import { isRetryableHubError } from './retryable-hub-error';

/** Maximum retry attempts before marking the record as failed. */
const MAX_ATTEMPTS = 5;

/** Base backoff in milliseconds; the delay grows with the attempt count. */
const BACKOFF_BASE_MS = 30_000;

/**
 * Simple per-attempt backoff: attempt 1 → 30s, attempt 2 → 60s, attempt 3 → 90s…
 * Linear is intentional — easy to reason about and bounded by MAX_ATTEMPTS.
 */
function computeNextRetryAt(attemptCount: number): Date {
  return new Date(Date.now() + BACKOFF_BASE_MS * attemptCount);
}

export interface EnqueuePayload {
  operation: 'accrue' | 'reverse';
  customerDni: string;
  saleRef?: string | null;
  points?: number;
  idempotencyKey?: string | null;
  userRef?: string | null;
}

/**
 * CarbopuntosPendingService — manages the local queue of hub operations
 * that failed due to hub unavailability (D16).
 *
 * Retried with a simple per-attempt backoff (next_retry_at): transient
 * failures (CarbopuntosUnavailableError) are rescheduled and retried up to
 * MAX_ATTEMPTS; permanent failures (CarbopuntosApiError, 4xx) are marked
 * failed immediately without consuming attempts. After MAX_ATTEMPTS,
 * status = 'failed' and the record requires manual review (C14).
 */
@Injectable()
export class CarbopuntosPendingService {
  private readonly logger = new Logger(CarbopuntosPendingService.name);

  constructor(
    @InjectRepository(CarbopuntosPendingMovement)
    private readonly pendingRepo: Repository<CarbopuntosPendingMovement>,
    @Optional()
    @Inject(CARBOPUNTOS_CLIENT_TOKEN)
    private readonly client: CarbopuntosClient | null,
  ) {}

  /** Enqueues a failed hub operation for later retry. */
  async enqueue(payload: EnqueuePayload): Promise<CarbopuntosPendingMovement> {
    const pending = this.pendingRepo.create({
      operation: payload.operation,
      customerDni: payload.customerDni,
      saleRef: payload.saleRef ?? null,
      points: payload.points ?? 0,
      idempotencyKey: payload.idempotencyKey ?? null,
      userRef: payload.userRef ?? null,
      status: 'pending',
      attemptCount: 0,
    });
    return this.pendingRepo.save(pending);
  }

  /**
   * Retries all pending/retrying movements.
   * Called from the sync endpoint or a scheduled job.
   */
  async retryPending(): Promise<void> {
    if (!this.client) {
      this.logger.warn('CarbopuntosClient not configured — skipping retry');
      return;
    }

    // Only pick up movements whose backoff window has elapsed
    // (nextRetryAt is null or already in the past).
    const pending = await this.pendingRepo.find({
      where: {
        status: In(['pending', 'retrying']),
        nextRetryAt: Or(IsNull(), LessThanOrEqual(new Date())),
      },
    });

    for (const movement of pending) {
      await this.retryOne(movement);
    }
  }

  private async retryOne(movement: CarbopuntosPendingMovement): Promise<void> {
    // The retry MUST reuse the original stored idempotency key. If it is
    // missing, that is a data error (we must never invent a new key, or the
    // hub could double-apply the operation) — mark it failed for manual review.
    if (!movement.idempotencyKey) {
      movement.status = 'failed';
      movement.lastError = 'Missing idempotencyKey — cannot safely retry';
      this.logger.error(
        `Movement ${movement.id} has no idempotencyKey. Marking as failed (data error).`,
      );
      await this.pendingRepo.save(movement);
      return;
    }

    try {
      if (movement.operation === 'accrue') {
        await this.client!.accrue({
          customerDni: movement.customerDni,
          points: movement.points,
          saleRef: movement.saleRef ?? undefined,
          userRef: movement.userRef ?? 'system',
          idempotencyKey: movement.idempotencyKey,
        });
      } else if (movement.operation === 'reverse') {
        await this.client!.reverse({
          customerDni: movement.customerDni,
          saleRef: movement.saleRef ?? '',
          userRef: movement.userRef ?? 'system',
          idempotencyKey: movement.idempotencyKey,
        });
      }

      movement.status = 'done';
      movement.lastError = null;
      movement.nextRetryAt = null;
      await this.pendingRepo.save(movement);
    } catch (err: unknown) {
      // Permanent (4xx business/validation) errors will never succeed on retry:
      // mark failed immediately WITHOUT consuming a retry attempt. Transient
      // failures (hub down / network / 5xx) are reschedulable.
      if (!isRetryableHubError(err)) {
        movement.status = 'failed';
        movement.lastError = String(err instanceof Error ? err.message : err);
        movement.nextRetryAt = null;
        this.logger.error(
          `Movement ${movement.id} failed permanently (non-retryable): ${movement.lastError}`,
        );
        await this.pendingRepo.save(movement);
        return;
      }

      // Transient failure: schedule the next retry with backoff.
      const newAttemptCount = movement.attemptCount + 1;

      if (newAttemptCount >= MAX_ATTEMPTS) {
        movement.status = 'failed';
        movement.nextRetryAt = null;
        this.logger.error(
          `Movement ${movement.id} reached max attempts (${MAX_ATTEMPTS}). Marking as failed.`,
        );
      } else {
        movement.status = 'retrying';
        movement.nextRetryAt = computeNextRetryAt(newAttemptCount);
      }

      movement.attemptCount = newAttemptCount;
      movement.lastError = String(err instanceof Error ? err.message : err);
      await this.pendingRepo.save(movement);
    }
  }
}

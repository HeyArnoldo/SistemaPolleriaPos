import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CarbopuntosPendingMovement } from './entities/pending-movement.entity';
import { CARBOPUNTOS_CLIENT_TOKEN } from './carbopuntos.tokens';
import type { CarbopuntosClient } from '@app/carbopuntos-client';
import { CarbopuntosUnavailableError } from '@app/carbopuntos-client';

/** Maximum retry attempts before marking the record as failed. */
const MAX_ATTEMPTS = 5;

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
 * Retried with a simple attempt counter (exponential backoff logic lives in
 * the scheduler/trigger that calls retryPending). After MAX_ATTEMPTS,
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

    const pending = await this.pendingRepo.find({
      where: { status: In(['pending', 'retrying']) },
    });

    for (const movement of pending) {
      await this.retryOne(movement);
    }
  }

  private async retryOne(movement: CarbopuntosPendingMovement): Promise<void> {
    try {
      if (movement.operation === 'accrue') {
        await this.client!.accrue({
          customerDni: movement.customerDni,
          points: movement.points,
          saleRef: movement.saleRef ?? undefined,
          userRef: movement.userRef ?? 'system',
          idempotencyKey: movement.idempotencyKey ?? `${movement.id}:retry`,
        });
      } else if (movement.operation === 'reverse') {
        await this.client!.reverse({
          customerDni: movement.customerDni,
          saleRef: movement.saleRef ?? '',
          userRef: movement.userRef ?? 'system',
          idempotencyKey: movement.idempotencyKey ?? `${movement.id}:reverse`,
        });
      }

      movement.status = 'done';
      movement.lastError = null;
      await this.pendingRepo.save(movement);
    } catch (err: unknown) {
      const newAttemptCount = movement.attemptCount + 1;
      const isUnavailable = err instanceof CarbopuntosUnavailableError || err instanceof Error;

      if (newAttemptCount >= MAX_ATTEMPTS) {
        movement.status = 'failed';
        this.logger.error(
          `Movement ${movement.id} reached max attempts (${MAX_ATTEMPTS}). Marking as failed.`,
        );
      } else {
        movement.status = 'retrying';
      }

      movement.attemptCount = newAttemptCount;
      movement.lastError = isUnavailable ? (err as Error).message : String(err);
      await this.pendingRepo.save(movement);
    }
  }
}

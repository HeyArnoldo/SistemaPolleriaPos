import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  OptimisticLockVersionMismatchError,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { PointsBalance } from '../entities/points-balance.entity';
import { PointsMovement, MovementType } from '../entities/points-movement.entity';
import { AdminAudit } from '../../audit/entities/admin-audit.entity';

export interface AccrueInput {
  customerDni: string;
  points: number;
  saleRef?: string;
  userRef: string;
  detail?: string;
  idempotencyKey: string;
  sede: string;
}

export interface RedeemInput {
  customerDni: string;
  points: number;
  saleRef?: string;
  userRef: string;
  detail?: string;
  idempotencyKey: string;
  sede: string;
}

export interface OperationInput {
  customerDni: string;
  accrualPoints: number;
  redemptionPoints: number;
  saleRef?: string;
  userRef: string;
  detail?: string;
  idempotencyKey: string;
  sede: string;
}

export interface ReverseInput {
  customerDni: string;
  saleRef: string;
  userRef: string;
  detail?: string;
  idempotencyKey: string;
  sede: string;
}

export interface AdjustInput {
  customerDni: string;
  points: number;
  reason: string;
  userRef: string;
  detail?: string;
  sede: string;
}

export interface VoidInput {
  movementId: string;
  reason: string;
  userRef: string;
  sede: string;
}

/** Máximo de reintentos por conflicto de versión en optimistic lock. */
const MAX_LOCK_RETRIES = 3;

/** SQLSTATE de Postgres para violación de restricción unique. */
const PG_UNIQUE_VIOLATION = '23505';

/** Detecta una violación de unique constraint de Postgres (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = (err as QueryFailedError & { driverError?: { code?: string } }).driverError;
  const code = driverError?.code ?? (err as unknown as { code?: string }).code;
  return code === PG_UNIQUE_VIOLATION;
}

/**
 * Servicio de operaciones de puntos del hub.
 *
 * Todas las operaciones que modifican `PointsBalance` + `PointsMovement`
 * son transaccionales con optimistic lock (D17).
 * La idempotencia se garantiza por `idempotency_key` UNIQUE (D15).
 * El saldo nunca queda negativo en operaciones normales (D6).
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  // ── Helpers internos ──────────────────────────────────────────────────────

  private async resolveCustomer(
    manager: EntityManager,
    dni: string,
  ): Promise<{ customer: Customer; balance: PointsBalance }> {
    const customer = await manager.findOne(Customer, { where: { dni } });
    if (!customer) throw new NotFoundException(`Cliente con DNI ${dni} no encontrado`);

    const balance = await manager.findOne(PointsBalance, { where: { customerId: customer.id } });
    if (!balance) throw new NotFoundException(`Saldo no encontrado para cliente ${dni}`);

    return { customer, balance };
  }

  private async saveMovement(
    manager: EntityManager,
    data: Partial<PointsMovement>,
  ): Promise<PointsMovement> {
    const movement = manager.create(PointsMovement, data as PointsMovement);
    return manager.save(movement);
  }

  /**
   * Inserta un movimiento garantizando idempotencia atómica (D15).
   *
   * El índice único sobre `idempotency_key` es la red de seguridad: si dos
   * requests concurrentes con la misma clave intentan insertar, Postgres lanza
   * 23505 en el segundo. En ese caso re-leemos el movimiento ya commiteado y lo
   * retornamos idempotentemente, sin doble aplicación ni 500.
   *
   * Devuelve `{ movement, created }` para que el caller sepa si fue inserción
   * nueva (y debe actualizar el saldo) o un replay (saldo intacto).
   */
  private async insertMovementIdempotent(
    manager: EntityManager,
    data: Partial<PointsMovement>,
  ): Promise<{ movement: PointsMovement; created: boolean }> {
    const idempotencyKey = data.idempotencyKey ?? null;
    try {
      const movement = await this.saveMovement(manager, data);
      return { movement, created: true };
    } catch (err: unknown) {
      if (isUniqueViolation(err) && idempotencyKey) {
        const existing = await manager.findOne(PointsMovement, {
          where: { idempotencyKey },
        });
        if (existing) {
          this.logger.log(
            `[idempotent] Unique violation en clave ${idempotencyKey} — re-leído movimiento existente`,
          );
          return { movement: existing, created: false };
        }
      }
      throw err;
    }
  }

  private async updateBalance(
    manager: EntityManager,
    balance: PointsBalance,
    newBalance: number,
  ): Promise<PointsBalance> {
    balance.balance = newBalance;
    return manager.save(balance);
  }

  private async saveAudit(manager: EntityManager, data: Partial<AdminAudit>): Promise<AdminAudit> {
    const audit = manager.create(AdminAudit, data as AdminAudit);
    return manager.save(audit);
  }

  // ── accrue ────────────────────────────────────────────────────────────────

  async accrue(input: AccrueInput): Promise<PointsMovement> {
    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        // Idempotencia: si ya existe un movimiento con esa clave, retornarlo.
        const existing = await manager.findOne(PointsMovement, {
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          this.logger.log(`[accrue] Idempotencia: clave ${input.idempotencyKey} ya procesada`);
          return existing;
        }

        const { customer, balance } = await this.resolveCustomer(manager, input.customerDni);
        const balanceBefore = balance.balance;
        const balanceAfter = balanceBefore + input.points;

        // Insertamos el movimiento ANTES de tocar el saldo: si una request
        // concurrente ya insertó la misma clave (23505), re-leemos y NO
        // aplicamos el saldo (lo aplicó la request ganadora).
        const { movement, created } = await this.insertMovementIdempotent(manager, {
          customerId: customer.id,
          type: 'accrual' as MovementType,
          points: input.points,
          balanceBefore,
          balanceAfter,
          sede: input.sede,
          userRef: input.userRef,
          saleRef: input.saleRef ?? null,
          detail: input.detail ?? null,
          idempotencyKey: input.idempotencyKey,
          isVoided: false,
        });
        if (!created) return movement;

        await this.updateBalance(manager, balance, balanceAfter);

        this.logger.log(
          `[accrue] DNI ${input.customerDni}: +${input.points} pts (${balanceBefore} → ${balanceAfter})`,
        );
        return movement;
      }),
    );
  }

  // ── redeem ────────────────────────────────────────────────────────────────

  async redeem(input: RedeemInput): Promise<PointsMovement> {
    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        const existing = await manager.findOne(PointsMovement, {
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          this.logger.log(`[redeem] Idempotencia: clave ${input.idempotencyKey} ya procesada`);
          return existing;
        }

        const { customer, balance } = await this.resolveCustomer(manager, input.customerDni);
        const balanceBefore = balance.balance;

        if (balanceBefore < input.points) {
          throw new UnprocessableEntityException(
            `Saldo insuficiente: tiene ${balanceBefore} pts, necesita ${input.points} pts`,
          );
        }

        const balanceAfter = balanceBefore - input.points;

        const { movement, created } = await this.insertMovementIdempotent(manager, {
          customerId: customer.id,
          type: 'redeem' as MovementType,
          points: -input.points,
          balanceBefore,
          balanceAfter,
          sede: input.sede,
          userRef: input.userRef,
          saleRef: input.saleRef ?? null,
          detail: input.detail ?? null,
          idempotencyKey: input.idempotencyKey,
          isVoided: false,
        });
        if (!created) return movement;

        await this.updateBalance(manager, balance, balanceAfter);

        this.logger.log(
          `[redeem] DNI ${input.customerDni}: -${input.points} pts (${balanceBefore} → ${balanceAfter})`,
        );
        return movement;
      }),
    );
  }

  // ── operation (mixta atómica) ─────────────────────────────────────────────

  async operation(input: OperationInput): Promise<PointsMovement[]> {
    // Keying consistente (D15): la acumulación usa la clave base y el canje
    // usa `${base}:redeem`. Así la idempotencia funciona también cuando solo
    // hay canje (accrualPoints === 0) y el replay puede recuperar el set exacto.
    const accrualKey = input.idempotencyKey;
    const redeemKey = `${input.idempotencyKey}:redeem`;

    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        // Replay: si ya existe CUALQUIERA de los movimientos de esta operación,
        // devolvemos exactamente el mismo set ordenado (acumulación, luego canje).
        const replayed = await this.findOperationMovements(manager, accrualKey, redeemKey);
        if (replayed.length > 0) {
          this.logger.log(`[operation] Idempotencia: clave ${input.idempotencyKey} ya procesada`);
          return replayed;
        }

        const { customer, balance } = await this.resolveCustomer(manager, input.customerDni);
        let currentBalance = balance.balance;
        const movements: PointsMovement[] = [];
        let replayedDuringInsert = false;

        // Paso 1: acumulación.
        if (input.accrualPoints > 0) {
          const balanceBefore = currentBalance;
          currentBalance += input.accrualPoints;

          const { movement, created } = await this.insertMovementIdempotent(manager, {
            customerId: customer.id,
            type: 'accrual' as MovementType,
            points: input.accrualPoints,
            balanceBefore,
            balanceAfter: currentBalance,
            sede: input.sede,
            userRef: input.userRef,
            saleRef: input.saleRef ?? null,
            detail: input.detail ?? null,
            idempotencyKey: accrualKey,
            isVoided: false,
          });
          if (!created) replayedDuringInsert = true;
          movements.push(movement);
        }

        // Paso 2: canje (en la misma tx — si falla, se revierte la acumulación).
        if (input.redemptionPoints > 0) {
          if (currentBalance < input.redemptionPoints) {
            throw new UnprocessableEntityException(
              `Saldo insuficiente para canje: tiene ${currentBalance} pts, necesita ${input.redemptionPoints} pts`,
            );
          }
          const balanceBefore = currentBalance;
          currentBalance -= input.redemptionPoints;

          const { movement, created } = await this.insertMovementIdempotent(manager, {
            customerId: customer.id,
            type: 'redeem' as MovementType,
            points: -input.redemptionPoints,
            balanceBefore,
            balanceAfter: currentBalance,
            sede: input.sede,
            userRef: input.userRef,
            saleRef: input.saleRef ?? null,
            detail: input.detail ?? null,
            idempotencyKey: redeemKey,
            isVoided: false,
          });
          if (!created) replayedDuringInsert = true;
          movements.push(movement);
        }

        // Si alguna inserción chocó con 23505 (carrera), la operación ya fue
        // aplicada por la request ganadora: NO aplicamos el saldo de nuevo y
        // devolvemos el set exacto persistido.
        if (replayedDuringInsert) {
          return this.findOperationMovements(manager, accrualKey, redeemKey);
        }

        balance.balance = currentBalance;
        await manager.save(balance);

        return movements;
      }),
    );
  }

  /**
   * Recupera los movimientos de una operación mixta por sus claves de
   * idempotencia, en orden determinista: acumulación primero, luego canje.
   */
  private async findOperationMovements(
    manager: EntityManager,
    accrualKey: string,
    redeemKey: string,
  ): Promise<PointsMovement[]> {
    const found = await manager.find(PointsMovement, {
      where: [{ idempotencyKey: accrualKey }, { idempotencyKey: redeemKey }],
    });
    const accrual = found.find((m) => m.idempotencyKey === accrualKey);
    const redeem = found.find((m) => m.idempotencyKey === redeemKey);
    const ordered: PointsMovement[] = [];
    if (accrual) ordered.push(accrual);
    if (redeem) ordered.push(redeem);
    return ordered;
  }

  // ── reverse ───────────────────────────────────────────────────────────────

  async reverse(input: ReverseInput): Promise<PointsMovement> {
    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        // Idempotencia: si ya existe la reversa, retornarla (contrato pelado).
        const existingReverse = await manager.findOne(PointsMovement, {
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existingReverse) {
          return existingReverse;
        }

        const { customer, balance } = await this.resolveCustomer(manager, input.customerDni);

        // Busca el movimiento de acumulación original para ese sale_ref.
        const accrual = await manager.findOne(PointsMovement, {
          where: {
            customerId: customer.id,
            saleRef: input.saleRef,
            type: 'accrual' as MovementType,
            isVoided: false,
          },
        });

        const balanceBefore = balance.balance;

        // C15: no-op si no hubo acumulación previa. En vez de un objeto especial,
        // creamos un movimiento de reversa de 0 puntos (saldo intacto) para que el
        // contrato PointsMovement se cumpla SIEMPRE (lo que el client espera).
        if (!accrual) {
          this.logger.log(
            `[reverse] No-op para DNI ${input.customerDni}, sale_ref ${input.saleRef} — sin acumulación previa`,
          );
          const { movement } = await this.insertMovementIdempotent(manager, {
            customerId: customer.id,
            type: 'reversal' as MovementType,
            points: 0,
            balanceBefore,
            balanceAfter: balanceBefore,
            sede: input.sede,
            userRef: input.userRef,
            saleRef: input.saleRef,
            detail:
              input.detail ?? 'No-op: sin acumulación previa para este sale_ref; saldo intacto',
            idempotencyKey: input.idempotencyKey,
            isVoided: false,
          });
          return movement;
        }

        // Topar en 0 si la reversa excedería el saldo (D6).
        const maxReversable = balanceBefore; // No puede quedar negativo.
        const actualReverse = Math.min(accrual.points, maxReversable);
        const balanceAfter = balanceBefore - actualReverse;

        const detail =
          accrual.points > maxReversable
            ? `Reversa parcial: se restaron ${actualReverse} pts (se solicitaron ${accrual.points}); saldo topado en 0`
            : (input.detail ?? null);

        const { movement, created } = await this.insertMovementIdempotent(manager, {
          customerId: customer.id,
          type: 'reversal' as MovementType,
          points: -actualReverse,
          balanceBefore,
          balanceAfter,
          sede: input.sede,
          userRef: input.userRef,
          saleRef: input.saleRef,
          detail,
          idempotencyKey: input.idempotencyKey,
          isVoided: false,
        });
        if (!created) return movement;

        await this.updateBalance(manager, balance, balanceAfter);

        return movement;
      }),
    );
  }

  // ── adjust ────────────────────────────────────────────────────────────────

  async adjust(input: AdjustInput): Promise<PointsMovement> {
    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        const { customer, balance } = await this.resolveCustomer(manager, input.customerDni);
        const balanceBefore = balance.balance;
        const balanceAfter = balanceBefore + input.points;

        // D6: ajuste que dejaría negativo se bloquea (admin también lo respeta).
        if (balanceAfter < 0) {
          throw new BadRequestException(
            `El ajuste de ${input.points} pts dejaría el saldo en ${balanceAfter}. El saldo no puede ser negativo.`,
          );
        }

        await this.updateBalance(manager, balance, balanceAfter);

        const movement = await this.saveMovement(manager, {
          customerId: customer.id,
          type: 'adjustment' as MovementType,
          points: input.points,
          balanceBefore,
          balanceAfter,
          sede: input.sede,
          userRef: input.userRef,
          detail: input.detail ?? null,
          idempotencyKey: null,
          isVoided: false,
        });

        // AdminAudit obligatorio (D8/D25).
        await this.saveAudit(manager, {
          action: 'adjust',
          actorRef: input.userRef,
          sede: input.sede,
          customerId: customer.id,
          movementId: movement.id,
          balanceBefore,
          balanceAfter,
          reason: input.reason,
          payload: null,
        });

        this.logger.log(
          `[adjust] Admin ${input.userRef} ajustó DNI ${input.customerDni}: ${input.points > 0 ? '+' : ''}${input.points} pts (${balanceBefore} → ${balanceAfter}). Motivo: ${input.reason}`,
        );

        return movement;
      }),
    );
  }

  // ── voidMovement ──────────────────────────────────────────────────────────

  async voidMovement(input: VoidInput): Promise<PointsMovement> {
    return this.withRetry(() =>
      this.customerRepo.manager.transaction(async (manager) => {
        const movement = await manager.findOne(PointsMovement, {
          where: { id: input.movementId },
        });
        if (!movement) throw new NotFoundException(`Movimiento ${input.movementId} no encontrado`);
        if (movement.isVoided) {
          throw new ConflictException(`Movimiento ${input.movementId} ya está anulado`);
        }

        const balance = await manager.findOne(PointsBalance, {
          where: { customerId: movement.customerId },
        });
        if (!balance) throw new NotFoundException('Saldo del cliente no encontrado');

        const balanceBefore = balance.balance;
        // Recalcular saldo revirtiendo el efecto del movimiento.
        const delta = movement.points; // Positivo = acumulación; negativo = canje.
        const balanceAfter = Math.max(0, balanceBefore - delta);

        await this.updateBalance(manager, balance, balanceAfter);

        // Soft-delete: marca como anulado con auditoría.
        movement.isVoided = true;
        movement.voidedBy = input.userRef;
        movement.voidedAt = new Date();
        movement.voidReason = input.reason;
        const saved = await manager.save(movement);

        // AdminAudit (D25).
        await this.saveAudit(manager, {
          action: 'void',
          actorRef: input.userRef,
          sede: input.sede,
          customerId: movement.customerId,
          movementId: movement.id,
          balanceBefore,
          balanceAfter,
          reason: input.reason,
          payload: { originalMovementId: movement.id, originalPoints: movement.points },
        });

        this.logger.log(
          `[void] Admin ${input.userRef} anuló movimiento ${movement.id}. Saldo: ${balanceBefore} → ${balanceAfter}`,
        );

        return saved;
      }),
    );
  }

  // ── Retry por optimistic lock conflict ────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        // Conflicto de concurrencia reintentable: mismatch de versión por
        // optimistic lock (por instanceof, no por substring del mensaje) o una
        // violación unique residual (23505) que no se resolvió por re-lectura.
        const isLockConflict =
          err instanceof OptimisticLockVersionMismatchError || isUniqueViolation(err);
        if (!isLockConflict) throw err;
        lastErr = err;
        this.logger.warn(
          `[withRetry] Conflicto de versión — intento ${attempt + 1}/${MAX_LOCK_RETRIES}`,
        );
      }
    }
    throw new ConflictException(
      `Conflicto de concurrencia tras ${MAX_LOCK_RETRIES} reintentos. Inténtalo de nuevo.`,
    );
    // Silencia el warning de no retornar — el throw garantiza que nunca llegamos acá.
    void lastErr;
  }
}

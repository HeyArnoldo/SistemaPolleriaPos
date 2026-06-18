import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * CarbopuntosPendingMovement — local queue for hub operations that failed
 * due to hub unavailability (D16). Retried with exponential backoff.
 * Status lifecycle: pending → retrying → done | failed.
 */
@Entity('carbopuntos_pending_movement')
export class CarbopuntosPendingMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Operation type: 'accrue' or 'reverse'. */
  @Column({ type: 'varchar', length: 20, name: 'operation' })
  operation: 'accrue' | 'reverse';

  @Column({ type: 'varchar', length: 8, name: 'customer_dni' })
  customerDni: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null, name: 'sale_ref' })
  saleRef: string | null;

  /** Points to accrue (only relevant for accrue operations). */
  @Column({ type: 'int', default: 0, name: 'points' })
  points: number;

  /** Idempotency key derived from {saleNumber, sede, tipo} (D15). */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null, name: 'idempotency_key' })
  idempotencyKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null, name: 'user_ref' })
  userRef: string | null;

  /** Status: pending | retrying | done | failed. */
  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'status' })
  status: 'pending' | 'retrying' | 'done' | 'failed';

  @Column({ type: 'int', default: 0, name: 'attempt_count' })
  attemptCount: number;

  @Column({ type: 'text', nullable: true, default: null, name: 'last_error' })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

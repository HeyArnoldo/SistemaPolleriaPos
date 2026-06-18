import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Tipos de movimiento permitidos.
export type MovementType = 'accrual' | 'redeem' | 'adjustment' | 'reversal';

// Movimiento de puntos: INMUTABLE (nunca se actualiza, solo se marca como anulado).
// idempotency_key: {saleNumber, sede, tipo} — garantiza que no se duplique (D15).
@Entity('points_movements')
@Unique(['idempotencyKey'])
export class PointsMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['accrual', 'redeem', 'adjustment', 'reversal'],
  })
  type!: MovementType;

  // Puede ser positivo (acumulación) o negativo (canje/reversa).
  @Column({ name: 'points', type: 'integer' })
  points!: number;

  @Column({ name: 'balance_before', type: 'integer' })
  balanceBefore!: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;

  // Sede que originó el movimiento (D14).
  @Column({ name: 'sede', type: 'varchar' })
  sede!: string;

  // Referencia débil al usuario de la sede (sin FK).
  @Column({ name: 'user_ref', type: 'varchar' })
  userRef!: string;

  // Referencia débil al número de venta de la sede (sin FK).
  @Column({ name: 'sale_ref', type: 'varchar', nullable: true })
  saleRef!: string | null;

  @Column({ name: 'detail', type: 'varchar', nullable: true })
  detail!: string | null;

  // Clave de idempotencia: nullable para movimientos de ajuste manual.
  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey!: string | null;

  // Soft-delete: el movimiento nunca se elimina, solo se marca como anulado.
  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided!: boolean;

  @Column({ name: 'voided_by', type: 'varchar', nullable: true })
  voidedBy!: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;

  @Column({ name: 'void_reason', type: 'varchar', nullable: true })
  voidReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

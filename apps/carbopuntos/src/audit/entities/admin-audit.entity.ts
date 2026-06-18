import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Tipos de acción de auditoría administrativa.
export type AuditAction = 'adjust' | 'void';

// Registro inmutable de acciones administrativas sobre puntos.
// Toda acción de ajuste o anulación genera un AdminAudit en la misma transacción (D8/D25).
@Entity('admin_audits')
export class AdminAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'action',
    type: 'enum',
    enum: ['adjust', 'void'],
  })
  action!: AuditAction;

  // Referencia débil al usuario admin de la sede (sin FK).
  @Column({ name: 'actor_ref', type: 'varchar' })
  actorRef!: string;

  // Sede desde donde se realizó la acción.
  @Column({ name: 'sede', type: 'varchar' })
  sede!: string;

  // Referencia al cliente afectado.
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  // Referencia al movimiento creado o anulado (null si la acción crea el movimiento directamente).
  @Column({ name: 'movement_id', type: 'uuid', nullable: true })
  movementId!: string | null;

  @Column({ name: 'balance_before', type: 'integer' })
  balanceBefore!: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;

  // Motivo de la acción admin: siempre requerido (D8/D25).
  @Column({ name: 'reason', type: 'varchar' })
  reason!: string;

  // Contexto extra libre en formato JSON.
  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

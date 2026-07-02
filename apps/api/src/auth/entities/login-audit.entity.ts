import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type LoginOutcome = 'success' | 'failure';
export type LoginFailureReason = 'bad_password' | 'unknown_user' | 'inactive';

/**
 * LoginAudit — append-only record of every login attempt.
 * No FK to users: stores attempted username even for unknown/non-existent users.
 * No UpdateDateColumn: this table is an evidence log, never mutated.
 */
@Entity('login_audit')
export class LoginAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Attempted username, always stored (even when user does not exist). */
  @Column({ type: 'varchar', length: 255, name: 'username' })
  username: string;

  @Column({ type: 'varchar', length: 20, name: 'outcome' })
  outcome: LoginOutcome;

  /** Null on success; set to a machine-readable reason on failure. */
  @Column({ type: 'varchar', length: 30, nullable: true, default: null, name: 'reason' })
  reason: LoginFailureReason | null;

  /**
   * Plain nullable int — NOT a FK.
   * Null when the user does not exist (unknown_user). A hard FK would reject
   * exactly the spray-attempt rows we want to capture.
   */
  @Column({ type: 'int', nullable: true, default: null, name: 'user_id' })
  userId: number | null;

  /** Client IP address (trust-proxy resolved). Max 45 chars covers IPv6. */
  @Column({ type: 'varchar', length: 45, nullable: true, default: null, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true, default: null, name: 'user_agent' })
  userAgent: string | null;

  /** Sede identifier from STORE_ID env. One API instance per sede. */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null, name: 'sede' })
  sede: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

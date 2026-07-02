import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * LoginLockoutAlert — append-only record of every lockout trigger event.
 * Persisted when a login attempt is refused because the identity has exceeded
 * the failure threshold within the sliding window.
 * No UpdateDateColumn: this table is an evidence log, never mutated.
 */
@Entity('login_lockout_alert')
export class LoginLockoutAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Attempted username that triggered the lockout. */
  @Column({ type: 'varchar', length: 255, name: 'username' })
  username: string;

  /** Sede identifier from STORE_ID env. One API instance per sede. */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null, name: 'sede' })
  sede: string | null;

  /** Client IP address (trust-proxy resolved). Max 45 chars covers IPv6. */
  @Column({ type: 'varchar', length: 45, nullable: true, default: null, name: 'ip_address' })
  ipAddress: string | null;

  /** Number of failures that tripped the threshold. */
  @Column({ type: 'int', name: 'failure_count' })
  failureCount: number;

  /** Name of the AlertChannel that handled delivery (e.g. 'log'). */
  @Column({ type: 'varchar', length: 30, name: 'channel' })
  channel: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

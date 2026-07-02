import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Profile } from './profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_system' })
  isSystem: boolean = false;

  @Column({ type: 'varchar', length: 20, default: Role.Cashier })
  role: Role;

  /**
   * AES-256-GCM encrypted TOTP secret envelope (v1:<iv>:<tag>:<ct>).
   * Null when 2FA is not enrolled. Never expose in API responses.
   */
  @Column({ type: 'varchar', length: 255, name: 'totp_secret', nullable: true, default: null })
  totpSecret: string | null = null;

  /** Whether TOTP 2FA is active for this user. Default false. */
  @Column({ type: 'boolean', default: false, name: 'totp_enabled' })
  totpEnabled: boolean = false;

  @OneToOne(() => Profile, { cascade: true, eager: false, nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

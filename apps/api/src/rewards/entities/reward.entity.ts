import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Reward — local reward catalog per sede. NOT a hub entity (D2).
 * Each sede defines its own reward offerings and their point cost.
 * The hub only records the redemption debit against the global balance.
 */
@Entity('rewards')
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'int', name: 'cost_points' })
  costPoints: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

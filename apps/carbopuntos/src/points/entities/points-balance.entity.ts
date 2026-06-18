import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Saldo de puntos de un cliente en el hub.
// version: optimistic locking — se incrementa en cada operación (D17).
// balance: nunca negativo en operaciones normales (D6).
@Entity('points_balances')
@Unique(['customerId'])
export class PointsBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // FK lógica a Customer (no FK de DB para evitar lock en escrituras masivas).
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'balance', type: 'integer', default: 0 })
  balance!: number;

  // Optimistic locking: TypeORM incrementa version en cada save().
  @VersionColumn({ name: 'version' })
  version!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

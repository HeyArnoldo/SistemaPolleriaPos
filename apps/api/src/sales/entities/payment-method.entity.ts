import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    name: 'commission_percentage',
  })
  commissionPercentage: number;

  @Column({ type: 'boolean', default: false, name: 'requires_transfer_time' })
  requiresTransferTime: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // QR image for this payment method (e.g. Yape QR shown at checkout).
  // Type `text` supports both plain URLs and base64 data URIs.
  // Recommended: keep data URIs under 200 KB to avoid large row sizes.
  @Column({ type: 'text', name: 'image_url', nullable: true, default: null })
  imageUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

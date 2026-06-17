import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SaleItem } from './sale-item.entity';
import { Payment } from './payment.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'sale_number' })
  saleNumber: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @OneToMany(() => Payment, (payment) => payment.sale, { cascade: true })
  payments: Payment[];

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'varchar', length: 50, default: 'paid', name: 'payment_status' })
  paymentStatus: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  notes: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_canceled' })
  isCanceled: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null, name: 'cancel_reason' })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null, name: 'canceled_at' })
  canceledAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'canceled_by' })
  canceledBy: User | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

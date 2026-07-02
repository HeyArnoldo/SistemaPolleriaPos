import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from './sale.entity';

/**
 * SaleRedemption — persists each reward redeemed within a sale (1-N child of Sale).
 *
 * The reward lives in the hub (D2); only its local trace is stored here so we can
 * render the "PREMIOS CANJEADOS" ticket block and surface canje in the cash report.
 * product_id is a weak nullable reference (no FK) because prizes are not bound to
 * a Product today (see design decision).
 */
@Entity('sale_redemptions')
export class SaleRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Explicit FK column — set manually in the transaction (GOTCHA #6).
   * Cascade from TypeORM is unreliable for child inserts; we set saleId = created.id
   * before calling manager.save().
   */
  @Column({ type: 'int', name: 'sale_id' })
  saleId: number;

  @ManyToOne(() => Sale, (sale) => sale.redemptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'int', name: 'cost_points' })
  costPoints: number;

  /**
   * Weak reference to a product (no FK — prizes are not bound to Product today).
   * Nullable; included for future per-product aggregation in the cash report.
   */
  @Column({ type: 'int', nullable: true, default: null, name: 'product_id' })
  productId: number | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

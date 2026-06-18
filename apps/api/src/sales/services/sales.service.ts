import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { Product } from '../../inventory/entities/product.entity';
import { User } from '../../users/user.entity';
import { CreateSaleDto, SyncSalesDto } from '../dto/create-sale.dto';
import {
  CARBOPUNTOS_CLIENT_TOKEN,
  CARBOPUNTOS_PENDING_TOKEN,
} from '../../carbopuntos/carbopuntos.tokens';
import { CarbopuntosPendingService } from '../../carbopuntos/pending-queue.service';
import type { CarbopuntosClient } from '@app/carbopuntos-client';
import { CarbopuntosUnavailableError } from '@app/carbopuntos-client';
import { ConfigService } from '@nestjs/config';

export interface SalesFilter {
  from?: string;
  to?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @Optional()
    @Inject(CARBOPUNTOS_CLIENT_TOKEN)
    private readonly carbopuntosClient: CarbopuntosClient | null,
    @Optional()
    @Inject(CARBOPUNTOS_PENDING_TOKEN)
    private readonly pendingService: CarbopuntosPendingService | null,
    @Optional()
    @Inject(ConfigService)
    private readonly config: ConfigService | null,
  ) {}

  /**
   * Builds a stable, sede-aware idempotency key (D15).
   *
   * The saleNumber is generated per sede on the client and is NOT unique
   * across sedes, while the hub is shared. Prefixing with STORE_ID guarantees
   * a globally unique key. The SAME key is stored on the pending queue so the
   * retry reuses it verbatim — never generating a new one.
   *
   * Format: `${storeId}:${saleNumber}:${type}`.
   */
  private buildIdempotencyKey(saleNumber: string, type: 'accrual' | 'reversal'): string {
    const storeId = this.config?.get<string>('STORE_ID') ?? '';
    return `${storeId}:${saleNumber}:${type}`;
  }

  async createSale(dto: CreateSaleDto, user: User): Promise<Sale> {
    if (dto.saleNumber) {
      const existing = await this.saleRepo.findOne({ where: { saleNumber: dto.saleNumber } });
      if (existing) throw new ConflictException(`Sale number "${dto.saleNumber}" already exists`);
    }

    // Compute totals from items
    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = subtotal;

    // Generate saleNumber if not provided
    const saleNumber =
      dto.saleNumber ??
      `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const customerDni = dto.customerDni;

    // Map from productId → puntaje, collected during the transaction.
    const puntajeMap = new Map<number, number>();

    // Persist the sale and its children in one transaction, setting the
    // sale_id FK explicitly on each item/payment (do not rely on cascade —
    // a misconfigured cascade inserts children with a null sale_id).
    const sale = await this.saleRepo.manager.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Sale, {
          saleNumber,
          user,
          subtotal,
          taxAmount: 0,
          totalAmount,
          paymentStatus: 'paid',
          notes: dto.notes ?? null,
          isCanceled: false,
          customerDni: customerDni ?? null, // weak reference to hub customer (D20)
          ...(dto.createdAt ? { createdAt: dto.createdAt } : {}),
        }),
      );

      for (const itemDto of dto.items) {
        const product = await manager.findOne(Product, { where: { id: itemDto.productId } });
        if (!product) throw new NotFoundException(`Product ${itemDto.productId} not found`);
        // Collect puntaje for later points calculation.
        puntajeMap.set(product.id, product.puntaje ?? 0);
        await manager.save(
          manager.create(SaleItem, {
            sale: created,
            product,
            quantity: itemDto.quantity,
            unitPrice: itemDto.unitPrice,
            subtotal: itemDto.quantity * itemDto.unitPrice,
          }),
        );
      }

      for (const payDto of dto.payments) {
        const pm = await manager.findOne(PaymentMethod, {
          where: { id: payDto.paymentMethodId },
        });
        if (!pm) throw new NotFoundException(`PaymentMethod ${payDto.paymentMethodId} not found`);

        const commissionPct = Number(pm.commissionPercentage);
        const gross = payDto.amount;
        const commissionAmount = gross * (commissionPct / 100);
        const net = gross - commissionAmount;

        await manager.save(
          manager.create(Payment, {
            sale: created,
            paymentMethod: pm,
            amount: payDto.amount,
            grossAmount: gross,
            netAmount: net,
            commissionPercentage: commissionPct,
            commissionAmount,
            transferTime: payDto.transferTime ?? null,
          }),
        );
      }

      const full = await manager.findOne(Sale, {
        where: { id: created.id },
        relations: ['user', 'items', 'items.product', 'payments', 'payments.paymentMethod'],
      });
      return full ?? created;
    });

    // Best-effort: accrue points after sale is persisted (D1/RNF-04).
    // Never blocks the sale if the hub is down.
    await this.tryAccrue(sale, dto.items, customerDni, user, puntajeMap);

    return sale;
  }

  /**
   * Tries to accrue points in the hub. If the hub is unavailable, enqueues
   * the operation for later retry (D16). Never throws — the sale is already saved.
   */
  private async tryAccrue(
    sale: Sale,
    items: Array<{ productId: number; quantity: number; unitPrice: number }>,
    customerDni: string | undefined | null,
    user: User,
    puntajeMap: Map<number, number>,
  ): Promise<void> {
    if (!customerDni || !this.carbopuntosClient) return;

    // Calculate total points: Σ (product.puntaje × quantity) (D3).
    const totalPoints = items.reduce((sum, item) => {
      return sum + (puntajeMap.get(item.productId) ?? 0) * item.quantity;
    }, 0);

    if (totalPoints <= 0) return; // No points to accrue

    const idempotencyKey = this.buildIdempotencyKey(sale.saleNumber, 'accrual');

    try {
      await this.carbopuntosClient.accrue({
        customerDni,
        points: totalPoints,
        saleRef: sale.saleNumber,
        userRef: String(user.id),
        idempotencyKey,
      });
    } catch (err: unknown) {
      // The sale is NEVER blocked regardless of error type (D1/RNF-04).
      // Only enqueue transient failures (hub down / network / timeout). A
      // CarbopuntosApiError (4xx business/validation) is permanent: retrying
      // won't fix it, so we just log it instead of polluting the queue (D16).
      if (err instanceof CarbopuntosUnavailableError) {
        this.logger.warn(
          `Hub unavailable accruing points for sale ${sale.saleNumber}: ${err.message}. Enqueuing for retry.`,
        );
        await this.pendingService?.enqueue({
          operation: 'accrue',
          customerDni,
          saleRef: sale.saleNumber,
          points: totalPoints,
          idempotencyKey,
          userRef: String(user.id),
        });
      } else {
        this.logger.error(
          `Permanent error accruing points for sale ${sale.saleNumber}: ${String(err)}. Not enqueuing.`,
        );
      }
    }
  }

  async syncSales(
    input: SyncSalesDto,
    user: User,
  ): Promise<{
    success: number;
    skipped: number;
    failed: { saleNumber?: string; error: string }[];
    message: string;
  }> {
    let success = 0;
    let skipped = 0;
    const failed: { saleNumber?: string; error: string }[] = [];
    for (const dto of input.sales) {
      try {
        if (dto.saleNumber) {
          const existing = await this.saleRepo.findOne({ where: { saleNumber: dto.saleNumber } });
          if (existing) {
            skipped++;
            continue;
          }
        }
        await this.createSale(dto, user);
        success++;
      } catch (e) {
        failed.push({
          saleNumber: dto.saleNumber,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      success,
      skipped,
      failed,
      message: `${success} creadas, ${skipped} duplicadas, ${failed.length} con error`,
    };
  }

  async findAll(filter: SalesFilter): Promise<{ data: Sale[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.userId) where['user'] = { id: filter.userId };
    if (filter.from && filter.to) {
      where['createdAt'] = Between(new Date(filter.from), new Date(filter.to));
    }

    const [data, total] = await this.saleRepo.findAndCount({
      where,
      relations: ['user', 'items', 'items.product', 'payments', 'payments.paymentMethod'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  async findOne(id: number): Promise<Sale> {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: [
        'user',
        'items',
        'items.product',
        'payments',
        'payments.paymentMethod',
        'canceledBy',
      ],
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async cancelSale(id: number, reason: string, canceledBy: User): Promise<Sale> {
    const sale = await this.findOne(id);
    if (sale.isCanceled) throw new ConflictException('Sale is already canceled');
    sale.isCanceled = true;
    sale.cancelReason = reason;
    sale.canceledAt = new Date();
    sale.canceledBy = canceledBy;
    const saved = await this.saleRepo.save(sale);

    // Best-effort: reverse points if sale had a customer (D5/C5).
    await this.tryReverse(saved, canceledBy);

    return saved;
  }

  /**
   * Tries to reverse points in the hub. If the hub is unavailable, enqueues
   * the reversal for later retry (D16). Never throws — cancellation is already saved.
   */
  private async tryReverse(sale: Sale, user: User): Promise<void> {
    if (!sale.customerDni || !this.carbopuntosClient) return;

    const idempotencyKey = this.buildIdempotencyKey(sale.saleNumber, 'reversal');

    try {
      await this.carbopuntosClient.reverse({
        customerDni: sale.customerDni,
        saleRef: sale.saleNumber,
        userRef: String(user.id),
        idempotencyKey,
      });
    } catch (err: unknown) {
      // Cancellation is already saved; never throw (D5/C5). Only enqueue
      // transient failures. A CarbopuntosApiError (4xx) is permanent — log it.
      if (err instanceof CarbopuntosUnavailableError) {
        this.logger.warn(
          `Hub unavailable reversing points for sale ${sale.saleNumber}: ${err.message}. Enqueuing for retry.`,
        );
        await this.pendingService?.enqueue({
          operation: 'reverse',
          customerDni: sale.customerDni,
          saleRef: sale.saleNumber,
          idempotencyKey,
          userRef: String(user.id),
        });
      } else {
        this.logger.error(
          `Permanent error reversing points for sale ${sale.saleNumber}: ${String(err)}. Not enqueuing.`,
        );
      }
    }
  }
}

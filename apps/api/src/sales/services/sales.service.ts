import {
  BadRequestException,
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
import type { RedemptionItemInput } from '@app/contracts';
import {
  CARBOPUNTOS_CLIENT_TOKEN,
  CARBOPUNTOS_PENDING_TOKEN,
} from '../../carbopuntos/carbopuntos.tokens';
import { CarbopuntosPendingService } from '../../carbopuntos/pending-queue.service';
import type { CarbopuntosClient } from '@app/carbopuntos-client';
import { ConfigService } from '@nestjs/config';
import { isRetryableHubError } from '../../carbopuntos/retryable-hub-error';

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
  private buildIdempotencyKey(
    saleNumber: string,
    type: 'accrual' | 'reversal' | 'operation' | 'redeem',
  ): string {
    const storeId = this.config?.get<string>('STORE_ID') ?? '';
    return `${storeId}:${saleNumber}:${type}`;
  }

  async createSale(dto: CreateSaleDto, user: User): Promise<Sale> {
    const hasRedemptions = dto.redemptions && dto.redemptions.length > 0;
    const hasItems = dto.items.length > 0;

    // Guard: empty cart without redemptions is never valid (F1 / existing rule).
    // Solo-canje (empty items + redemptions) is allowed per F5.
    if (!hasItems && !hasRedemptions) {
      throw new BadRequestException(
        'At least one item is required when no redemptions are present',
      );
    }

    if (dto.saleNumber) {
      const existing = await this.saleRepo.findOne({ where: { saleNumber: dto.saleNumber } });
      if (existing) throw new ConflictException(`Sale number "${dto.saleNumber}" already exists`);
    }

    // Compute totals from items only — redemptions are courtesy, NOT monetary (D4).
    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = subtotal;

    // Generate saleNumber if not provided
    const saleNumber =
      dto.saleNumber ??
      `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const customerDni = dto.customerDni;

    // Map from productId → puntaje, collected during the transaction.
    const puntajeMap = new Map<number, number>();

    // Consistency rule for the canje path (D1/C1/C3):
    // When the sale carries redemptions the hub debit MUST happen and succeed
    // BEFORE we persist anything locally. Otherwise a hub rejection (insufficient
    // balance / 4xx) or outage would leave a registered sale with no debit —
    // including an orphan "solo canje" sale with total 0 and no points spent.
    // The accrual-only path is untouched: persist first, then best-effort accrue.
    if (hasRedemptions) {
      return this.createSaleWithRedemptions(dto, user, saleNumber, subtotal, totalAmount);
    }

    // Persist the sale and its children in one transaction, setting the
    // sale_id FK explicitly on each item/payment (do not rely on cascade —
    // a misconfigured cascade inserts children with a null sale_id).
    const sale = await this.persistSale(dto, user, saleNumber, subtotal, totalAmount, puntajeMap);

    // Best-effort: enqueue on transient hub failure (existing behavior).
    await this.tryAccrue(sale, dto.items, customerDni, user, puntajeMap);

    return sale;
  }

  /**
   * Persists the sale and its children (items/payments) in a single local
   * transaction, setting the sale_id FK explicitly on each child. Returns the
   * fully-hydrated Sale. The puntajeMap is populated as a side effect so the
   * caller can compute points afterwards.
   */
  private async persistSale(
    dto: CreateSaleDto,
    user: User,
    saleNumber: string,
    subtotal: number,
    totalAmount: number,
    puntajeMap: Map<number, number>,
  ): Promise<Sale> {
    return this.saleRepo.manager.transaction(async (manager) => {
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
          customerDni: dto.customerDni ?? null, // weak reference to hub customer (D20)
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
  }

  /**
   * Canje path (F5/F6) — hub debit FIRST, local persist SECOND (D1/C1/C3).
   *
   * The saleNumber is known up front (client-generated), so the idempotency key
   * is built before any persistence. We call the hub (operation or redeem):
   * if it rejects or is unavailable, we throw WITHOUT persisting the sale — the
   * canje never degrades to the queue. Only after the hub confirms the debit do
   * we open the local transaction. If that local persist fails AFTER the debit,
   * we issue a best-effort compensating reverse (idempotent by the same sale key)
   * and re-throw, so points are not silently lost.
   */
  private async createSaleWithRedemptions(
    dto: CreateSaleDto,
    user: User,
    saleNumber: string,
    subtotal: number,
    totalAmount: number,
  ): Promise<Sale> {
    const customerDni = dto.customerDni;
    if (!customerDni) {
      throw new BadRequestException('A customer is required to redeem points');
    }

    // Resolve puntaje for each product BEFORE persisting so we can compute the
    // accrual side of the operation. This mirrors what persistSale collects.
    const puntajeMap = new Map<number, number>();
    for (const itemDto of dto.items) {
      const product = await this.saleRepo.manager.findOne(Product, {
        where: { id: itemDto.productId },
      });
      if (!product) throw new NotFoundException(`Product ${itemDto.productId} not found`);
      puntajeMap.set(product.id, product.puntaje ?? 0);
    }

    // A redeem-only canje has no accrual side (empty cart or all puntaje=0). The
    // hub `reverse` validates a prior accrual (C15), so it CANNOT restore a
    // redeem-only debit — we flag this for honest compensation reporting.
    const totalAccrual = dto.items.reduce(
      (sum, item) => sum + (puntajeMap.get(item.productId) ?? 0) * item.quantity,
      0,
    );
    const isRedeemOnly = totalAccrual <= 0;

    // Step 1: hub debit. Throws on any failure (D1) — nothing persisted yet.
    await this.tryOperation(saleNumber, dto.items, customerDni, user, puntajeMap, dto.redemptions!);

    // Step 2: hub confirmed the debit — persist the local sale.
    try {
      return await this.persistSale(dto, user, saleNumber, subtotal, totalAmount, puntajeMap);
    } catch (persistErr: unknown) {
      // The debit already happened in the hub but the local write failed. Issue a
      // best-effort compensating reverse (idempotent by the sale's STORE_ID key)
      // so the customer's points are returned, then re-throw the original error.
      await this.compensateReverse(saleNumber, customerDni, user, persistErr, isRedeemOnly);
      throw persistErr;
    }
  }

  /**
   * Best-effort compensation when a local persist fails after a successful hub
   * debit. Idempotent by the sale's STORE_ID-prefixed key, so a later retry of
   * the whole sale does not double-debit. Never throws — logs on failure.
   *
   * LIMITACIÓN (C15): el `reverse` del hub valida una acumulación previa, así
   * que para un canje SOLO-redeem (sin acumulación) es un no-op — NO devuelve los
   * puntos debitados. En ese caso dejamos el reverse best-effort igual, pero
   * logueamos un error explícito de revisión manual para que no quede silencioso.
   * (Seguimiento futuro fuera de WU-6a: que `/points/reverse` revierta canjes.)
   */
  private async compensateReverse(
    saleNumber: string,
    customerDni: string,
    user: User,
    cause: unknown,
    isRedeemOnly: boolean,
  ): Promise<void> {
    if (!this.carbopuntosClient) return;
    const idempotencyKey = this.buildIdempotencyKey(saleNumber, 'reversal');
    try {
      this.logger.warn(
        `Local persist failed after hub debit for sale ${saleNumber}: ${String(cause)}. Issuing compensating reverse.`,
      );
      await this.carbopuntosClient.reverse({
        customerDni,
        saleRef: saleNumber,
        userRef: String(user.id),
        idempotencyKey,
      });
      if (isRedeemOnly) {
        // El reverse probablemente fue un no-op en el hub (C15): el canje quedó
        // debitado sin venta persistida. No podemos garantizar la devolución.
        this.logger.error(
          `Requiere revisión manual: canje debitado sin venta persistida para la venta ${saleNumber} ` +
            `(customerDni=${customerDni}). El reverse del hub no revierte canjes solo-redeem (C15).`,
        );
      }
    } catch (reverseErr: unknown) {
      this.logger.error(
        `Compensating reverse FAILED for sale ${saleNumber}: ${String(reverseErr)}. Manual reconciliation required.`,
      );
    }
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
      // Only enqueue transient failures (hub down / network / 5xx). A 4xx
      // business/validation error is permanent: retrying won't fix it, so we
      // just log it instead of polluting the queue (D16).
      if (isRetryableHubError(err)) {
        this.logger.warn(
          `Transient hub failure accruing points for sale ${sale.saleNumber}: ${String(err)}. Enqueuing for retry.`,
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

  /**
   * Executes the combined accrue + redeem (or redeem-only) operation for a sale
   * that includes redemptions.
   *
   * KEY RULE (D1/C1/C3): the canje ALWAYS requires hub online. If the hub is
   * unavailable or returns any error, this method THROWS — the caller is expected
   * to propagate the error so the front-end can inform the cashier. We never
   * enqueue redemptions for silent retry (unlike plain accruals).
   */
  private async tryOperation(
    saleNumber: string,
    items: Array<{ productId: number; quantity: number; unitPrice: number }>,
    customerDni: string,
    user: User,
    puntajeMap: Map<number, number>,
    redemptions: RedemptionItemInput[],
  ): Promise<void> {
    if (!this.carbopuntosClient) {
      throw new Error('Carbopuntos hub is not configured — redemptions require hub connectivity');
    }

    const totalAcrual = items.reduce((sum, item) => {
      return sum + (puntajeMap.get(item.productId) ?? 0) * item.quantity;
    }, 0);

    const totalRedemptionPoints = redemptions.reduce((sum, r) => sum + r.costPoints, 0);
    const redeemDetail = redemptions.map((r) => r.description).join('; ');

    if (totalAcrual > 0) {
      // Mixed: accrue + redeem in one atomic transaction (F6).
      const idempotencyKey = this.buildIdempotencyKey(saleNumber, 'operation');
      await this.carbopuntosClient.operation({
        customerDni,
        accrualPoints: totalAcrual,
        redemptionPoints: totalRedemptionPoints,
        saleRef: saleNumber,
        userRef: String(user.id),
        detail: redeemDetail,
        idempotencyKey,
      });
    } else {
      // Redeem only (no accrual — e.g., all products have puntaje=0, or empty cart) (F5).
      const idempotencyKey = this.buildIdempotencyKey(saleNumber, 'redeem');
      await this.carbopuntosClient.redeem({
        customerDni,
        points: totalRedemptionPoints,
        saleRef: saleNumber,
        userRef: String(user.id),
        detail: redeemDetail,
        idempotencyKey,
      });
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
      // transient failures (hub down / network / 5xx). A 4xx error is
      // permanent — log it.
      if (isRetryableHubError(err)) {
        this.logger.warn(
          `Transient hub failure reversing points for sale ${sale.saleNumber}: ${String(err)}. Enqueuing for retry.`,
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

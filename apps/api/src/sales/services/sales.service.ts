import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { Product } from '../../inventory/entities/product.entity';
import { User } from '../../users/user.entity';
import { CreateSaleDto, SyncSalesDto } from '../dto/create-sale.dto';

export interface SalesFilter {
  from?: string;
  to?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesService {
  constructor(@InjectRepository(Sale) private readonly saleRepo: Repository<Sale>) {}

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

    // Persist the sale and its children in one transaction, setting the
    // sale_id FK explicitly on each item/payment (do not rely on cascade —
    // a misconfigured cascade inserts children with a null sale_id).
    return this.saleRepo.manager.transaction(async (manager) => {
      const sale = await manager.save(
        manager.create(Sale, {
          saleNumber,
          user,
          subtotal,
          taxAmount: 0,
          totalAmount,
          paymentStatus: 'paid',
          notes: dto.notes ?? null,
          isCanceled: false,
          ...(dto.createdAt ? { createdAt: dto.createdAt } : {}),
        }),
      );

      for (const itemDto of dto.items) {
        const product = await manager.findOne(Product, { where: { id: itemDto.productId } });
        if (!product) throw new NotFoundException(`Product ${itemDto.productId} not found`);
        await manager.save(
          manager.create(SaleItem, {
            sale,
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
            sale,
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
        where: { id: sale.id },
        relations: ['user', 'items', 'items.product', 'payments', 'payments.paymentMethod'],
      });
      return full ?? sale;
    });
  }

  async syncSales(input: SyncSalesDto, user: User): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const dto of input.sales) {
      if (dto.saleNumber) {
        const existing = await this.saleRepo.findOne({ where: { saleNumber: dto.saleNumber } });
        if (existing) {
          skipped++;
          continue;
        }
      }
      await this.createSale(dto, user);
      created++;
    }
    return { created, skipped };
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
    return this.saleRepo.save(sale);
  }
}

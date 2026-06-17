import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { PaymentMethod } from '../../sales/entities/payment-method.entity';
import { Payment } from '../../sales/entities/payment.entity';
import { User } from '../../users/user.entity';
import { CreateExpenseDto, SyncExpensesDto } from '../dto/create-expense.dto';

export interface DateRangeFilter {
  from?: string;
  to?: string;
}

/** @deprecated Use CashDashboardResponse instead */
export interface DashboardItem {
  paymentMethodId: number;
  paymentMethodName: string;
  totalExpenses: number;
  count: number;
}

export interface CashDashboardSummaryRow {
  paymentMethodId: number;
  paymentMethodName: string;
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  expensesTotal: number;
  netTotal: number;
}

export interface CashDashboardTotals {
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  expensesTotal: number;
  netTotal: number;
}

export interface CashDashboardTransaction {
  type: 'sale' | 'expense';
  concept?: string;
  saleNumber?: string | null;
  description?: string | null;
  paymentMethodId: number;
  paymentMethodName: string;
  amount: number;
  grossAmount: number;
  netAmount: number;
  commissionAmount: number;
  createdAt: string;
}

export interface CashDashboardResponse {
  summary: CashDashboardSummaryRow[];
  totals: CashDashboardTotals;
  transactions: CashDashboardTransaction[];
}

/** Parse a YYYY-MM-DD string into a UTC Date range covering that full day in GMT-5 (America/Lima). */
function parseLimaDayRange(dateStr: string): { start: Date; end: Date } {
  // Lima is UTC-5 (no DST). Midnight Lima = 05:00 UTC; end-of-day = next day 04:59:59.999 UTC.
  const start = new Date(`${dateStr}T00:00:00.000-05:00`);
  const end = new Date(`${dateStr}T23:59:59.999-05:00`);
  return { start, end };
}

/** Return today's date string (YYYY-MM-DD) in America/Lima timezone. */
function todayInLima(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(PaymentMethod) private readonly pmRepo: Repository<PaymentMethod>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
  ) {}

  async createExpense(dto: CreateExpenseDto, createdBy: User): Promise<Expense> {
    const pm = await this.pmRepo.findOne({ where: { id: dto.paymentMethodId } });
    if (!pm) throw new NotFoundException(`PaymentMethod ${dto.paymentMethodId} not found`);

    const expense = this.expenseRepo.create({
      description: dto.description,
      amount: dto.amount,
      receiptNumber: dto.receiptNumber ?? null,
      paymentMethod: pm,
      createdBy,
      ...(dto.createdAt ? { createdAt: dto.createdAt } : {}),
    });
    return this.expenseRepo.save(expense);
  }

  async syncExpenses(input: SyncExpensesDto, createdBy: User): Promise<{ created: number }> {
    let created = 0;
    for (const dto of input.expenses) {
      await this.createExpense(dto, createdBy);
      created++;
    }
    return { created };
  }

  async findAll(filter: DateRangeFilter): Promise<Expense[]> {
    const hasFrom = filter.from && !isNaN(new Date(filter.from).getTime());
    const hasTo = filter.to && !isNaN(new Date(filter.to).getTime());

    return this.expenseRepo.find({
      where:
        hasFrom && hasTo
          ? { createdAt: Between(new Date(filter.from!), new Date(filter.to!)) }
          : {},
      relations: ['paymentMethod', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteExpense(id: number): Promise<{ deleted: boolean }> {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    await this.expenseRepo.remove(expense);
    return { deleted: true };
  }

  async getDashboard(date?: string): Promise<CashDashboardResponse> {
    const resolvedDate = date ?? todayInLima();
    const { start, end } = parseLimaDayRange(resolvedDate);

    // ── Sales by payment method ──────────────────────────────────────────
    interface SalesByMethodRaw {
      paymentMethodId: string;
      paymentMethodName: string;
      salesGross: string;
      salesNet: string;
      commissionsTotal: string;
    }

    const salesRows = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.sale', 'sale')
      .innerJoin('payment.paymentMethod', 'method')
      .select('method.id', 'paymentMethodId')
      .addSelect('method.name', 'paymentMethodName')
      .addSelect('COALESCE(SUM(payment.grossAmount), 0)', 'salesGross')
      .addSelect('COALESCE(SUM(payment.netAmount), 0)', 'salesNet')
      .addSelect('COALESCE(SUM(payment.commissionAmount), 0)', 'commissionsTotal')
      .where('sale.isCanceled = :isCanceled', { isCanceled: false })
      .andWhere('sale.createdAt >= :start', { start })
      .andWhere('sale.createdAt <= :end', { end })
      .groupBy('method.id')
      .addGroupBy('method.name')
      .orderBy('method.name', 'ASC')
      .getRawMany<SalesByMethodRaw>();

    // ── Expenses by payment method ───────────────────────────────────────
    interface ExpensesByMethodRaw {
      paymentMethodId: string;
      paymentMethodName: string;
      expensesTotal: string;
    }

    const expenseRows = await this.expenseRepo
      .createQueryBuilder('expense')
      .innerJoin('expense.paymentMethod', 'method')
      .select('method.id', 'paymentMethodId')
      .addSelect('method.name', 'paymentMethodName')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'expensesTotal')
      .where('expense.createdAt >= :start', { start })
      .andWhere('expense.createdAt <= :end', { end })
      .groupBy('method.id')
      .addGroupBy('method.name')
      .orderBy('method.name', 'ASC')
      .getRawMany<ExpensesByMethodRaw>();

    // ── Merge into one row per payment method ────────────────────────────
    const methodMap = new Map<
      number,
      {
        paymentMethodId: number;
        paymentMethodName: string;
        salesGross: number;
        salesNet: number;
        commissionsTotal: number;
        expensesTotal: number;
      }
    >();

    for (const row of salesRows) {
      const id = Number(row.paymentMethodId);
      methodMap.set(id, {
        paymentMethodId: id,
        paymentMethodName: row.paymentMethodName,
        salesGross: Number(row.salesGross),
        salesNet: Number(row.salesNet),
        commissionsTotal: Number(row.commissionsTotal),
        expensesTotal: 0,
      });
    }

    for (const row of expenseRows) {
      const id = Number(row.paymentMethodId);
      const existing = methodMap.get(id);
      if (existing) {
        existing.expensesTotal = Number(row.expensesTotal);
      } else {
        methodMap.set(id, {
          paymentMethodId: id,
          paymentMethodName: row.paymentMethodName,
          salesGross: 0,
          salesNet: 0,
          commissionsTotal: 0,
          expensesTotal: Number(row.expensesTotal),
        });
      }
    }

    const summary: CashDashboardSummaryRow[] = Array.from(methodMap.values())
      .sort((a, b) => a.paymentMethodName.localeCompare(b.paymentMethodName))
      .map((m) => ({
        ...m,
        netTotal: Number((m.salesNet - m.expensesTotal).toFixed(2)),
      }));

    // ── Totals ───────────────────────────────────────────────────────────
    const totals: CashDashboardTotals = summary.reduce(
      (acc, row) => ({
        salesGross: Number((acc.salesGross + row.salesGross).toFixed(2)),
        salesNet: Number((acc.salesNet + row.salesNet).toFixed(2)),
        commissionsTotal: Number((acc.commissionsTotal + row.commissionsTotal).toFixed(2)),
        expensesTotal: Number((acc.expensesTotal + row.expensesTotal).toFixed(2)),
        netTotal: Number((acc.netTotal + row.netTotal).toFixed(2)),
      }),
      { salesGross: 0, salesNet: 0, commissionsTotal: 0, expensesTotal: 0, netTotal: 0 },
    );

    // ── Transactions list ────────────────────────────────────────────────
    interface PaymentRaw {
      paymentId: string;
      saleNumber: string | null;
      paymentMethodId: string;
      paymentMethodName: string;
      amount: string;
      grossAmount: string;
      netAmount: string;
      commissionAmount: string;
      createdAt: Date;
    }

    const paymentTxRows = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.sale', 'sale')
      .innerJoin('payment.paymentMethod', 'method')
      .select('payment.id', 'paymentId')
      .addSelect('sale.saleNumber', 'saleNumber')
      .addSelect('method.id', 'paymentMethodId')
      .addSelect('method.name', 'paymentMethodName')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.grossAmount', 'grossAmount')
      .addSelect('payment.netAmount', 'netAmount')
      .addSelect('payment.commissionAmount', 'commissionAmount')
      .addSelect('sale.createdAt', 'createdAt')
      .where('sale.isCanceled = :isCanceled', { isCanceled: false })
      .andWhere('sale.createdAt >= :start', { start })
      .andWhere('sale.createdAt <= :end', { end })
      .orderBy('sale.createdAt', 'ASC')
      .addOrderBy('payment.id', 'ASC')
      .getRawMany<PaymentRaw>();

    const expenseTxRows = await this.expenseRepo.find({
      where: { createdAt: Between(start, end) },
      relations: ['paymentMethod'],
      order: { createdAt: 'ASC' },
    });

    const saleTxs: CashDashboardTransaction[] = paymentTxRows.map((row) => ({
      type: 'sale',
      saleNumber: row.saleNumber ?? null,
      paymentMethodId: Number(row.paymentMethodId),
      paymentMethodName: row.paymentMethodName,
      amount: Number(row.amount),
      grossAmount: Number(row.grossAmount),
      netAmount: Number(row.netAmount),
      commissionAmount: Number(row.commissionAmount),
      createdAt: new Date(row.createdAt).toISOString(),
    }));

    const expenseTxs: CashDashboardTransaction[] = expenseTxRows.map((e) => ({
      type: 'expense',
      description: e.description,
      paymentMethodId: e.paymentMethod.id,
      paymentMethodName: e.paymentMethod.name,
      amount: Number(e.amount),
      grossAmount: Number(e.amount),
      netAmount: Number(e.amount),
      commissionAmount: 0,
      createdAt: new Date(e.createdAt).toISOString(),
    }));

    const transactions: CashDashboardTransaction[] = [...saleTxs, ...expenseTxs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return { summary, totals, transactions };
  }
}

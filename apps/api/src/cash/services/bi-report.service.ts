import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { Payment } from '../../sales/entities/payment.entity';
import { BIQuery } from '@app/contracts';
import { resolveRangeStart, resolveRangeEnd } from './cash.service';

type ResolvedPeriod = { start: Date; end: Date };

interface TotalsRow {
  totalSalesGross: string;
  totalSalesNet: string;
  totalCommissions: string;
  transactionCount: string;
}

interface ByPaymentMethodRow {
  paymentMethodId: string;
  paymentMethodName: string;
  commissionPercentage: string;
  salesGross: string;
  salesNet: string;
  commissionsTotal: string;
  transactionCount: string;
  averageTicket: string;
}

interface TrendRow {
  date: string;
  salesGross: string;
  salesNet: string;
  commissionsTotal: string;
  transactionCount: string;
}

interface DetailRow {
  id: string;
  saleNumber: string;
  date: Date;
  paymentMethodId: string;
  paymentMethodName: string;
  grossAmount: string;
  netAmount: string;
  commissionAmount: string;
  commissionPercentage: string;
}

@Injectable()
export class BIReportService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async getSummary(query: BIQuery) {
    const period = this.resolvePeriod(query);
    const paymentQb = this.createPaymentBaseQuery(period, query.paymentMethodIds);

    const totalsRow = await paymentQb
      .clone()
      .select('COALESCE(SUM(payment.grossAmount),0)', 'totalSalesGross')
      .addSelect('COALESCE(SUM(payment.netAmount),0)', 'totalSalesNet')
      .addSelect('COALESCE(SUM(payment.commissionAmount),0)', 'totalCommissions')
      .addSelect('COUNT(payment.id)', 'transactionCount')
      .getRawOne<TotalsRow>();

    const expensesQb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.paymentMethod', 'method')
      .select('COALESCE(SUM(expense.amount),0)', 'totalExpenses')
      .where('expense.createdAt >= :startDate', { startDate: period.start })
      .andWhere('expense.createdAt <= :endDate', { endDate: period.end });

    if (query.paymentMethodIds?.length) {
      expensesQb.andWhere('method.id IN (:...paymentMethodIds)', {
        paymentMethodIds: query.paymentMethodIds,
      });
    }

    const expensesRow = await expensesQb.getRawOne<{ totalExpenses: string }>();

    const byPaymentMethodRows = await paymentQb
      .clone()
      .select('method.id', 'paymentMethodId')
      .addSelect('method.name', 'paymentMethodName')
      .addSelect('COALESCE(AVG(payment.commissionPercentage),0)', 'commissionPercentage')
      .addSelect('COALESCE(SUM(payment.grossAmount),0)', 'salesGross')
      .addSelect('COALESCE(SUM(payment.netAmount),0)', 'salesNet')
      .addSelect('COALESCE(SUM(payment.commissionAmount),0)', 'commissionsTotal')
      .addSelect('COUNT(payment.id)', 'transactionCount')
      .addSelect('COALESCE(AVG(payment.grossAmount),0)', 'averageTicket')
      .groupBy('method.id')
      .addGroupBy('method.name')
      .orderBy('method.name', 'ASC')
      .getRawMany<ByPaymentMethodRow>();

    const trend = await this.getTrends(query);

    const totalSalesGross = Number(totalsRow?.totalSalesGross ?? 0);
    const totalSalesNet = Number(totalsRow?.totalSalesNet ?? 0);
    const totalCommissions = Number(totalsRow?.totalCommissions ?? 0);
    const totalExpenses = Number(expensesRow?.totalExpenses ?? 0);

    return {
      period,
      summary: {
        totalSalesGross,
        totalSalesNet,
        totalCommissions,
        totalExpenses,
        netProfit: Number((totalSalesNet - totalExpenses).toFixed(2)),
        transactionCount: Number(totalsRow?.transactionCount ?? 0),
      },
      byPaymentMethod: byPaymentMethodRows.map((row) => ({
        paymentMethodId: Number(row.paymentMethodId),
        paymentMethodName: row.paymentMethodName,
        commissionPercentage: Number(row.commissionPercentage),
        salesGross: Number(row.salesGross),
        salesNet: Number(row.salesNet),
        commissionsTotal: Number(row.commissionsTotal),
        transactionCount: Number(row.transactionCount),
        averageTicket: Number(Number(row.averageTicket).toFixed(2)),
      })),
      trend,
    };
  }

  async getDetail(query: BIQuery) {
    const period = this.resolvePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.createPaymentBaseQuery(period, query.paymentMethodIds)
      .select('payment.id', 'id')
      .addSelect('sale.saleNumber', 'saleNumber')
      .addSelect('sale.createdAt', 'date')
      .addSelect('method.id', 'paymentMethodId')
      .addSelect('method.name', 'paymentMethodName')
      .addSelect('payment.grossAmount', 'grossAmount')
      .addSelect('payment.netAmount', 'netAmount')
      .addSelect('payment.commissionAmount', 'commissionAmount')
      .addSelect('payment.commissionPercentage', 'commissionPercentage')
      .orderBy('sale.createdAt', 'DESC')
      .addOrderBy('payment.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await Promise.all([
      qb.getRawMany<DetailRow>(),
      this.createPaymentBaseQuery(period, query.paymentMethodIds).getCount(),
    ]);

    return {
      transactions: rows.map((row) => ({
        id: Number(row.id),
        saleNumber: row.saleNumber,
        date: new Date(row.date),
        paymentMethodId: Number(row.paymentMethodId),
        paymentMethodName: row.paymentMethodName,
        grossAmount: Number(row.grossAmount),
        netAmount: Number(row.netAmount),
        commissionAmount: Number(row.commissionAmount),
        commissionPercentage: Number(row.commissionPercentage),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getCommissionsReport(query: BIQuery) {
    const summary = await this.getSummary(query);
    return {
      period: summary.period,
      totalCommissions: summary.summary.totalCommissions,
      byPaymentMethod: summary.byPaymentMethod.map((method) => ({
        paymentMethodId: method.paymentMethodId,
        paymentMethodName: method.paymentMethodName,
        commissionPercentage: method.commissionPercentage,
        commissionsTotal: method.commissionsTotal,
      })),
    };
  }

  async getTrends(query: BIQuery) {
    const period = this.resolvePeriod(query);
    const groupBy = query.groupBy ?? 'day';
    const bucket = this.resolveDateBucket(groupBy);

    const rows = await this.createPaymentBaseQuery(period, query.paymentMethodIds)
      .select(
        `TO_CHAR(DATE_TRUNC('${bucket}', sale.createdAt AT TIME ZONE 'America/Lima'), 'YYYY-MM-DD')`,
        'date',
      )
      .addSelect('COALESCE(SUM(payment.grossAmount),0)', 'salesGross')
      .addSelect('COALESCE(SUM(payment.netAmount),0)', 'salesNet')
      .addSelect('COALESCE(SUM(payment.commissionAmount),0)', 'commissionsTotal')
      .addSelect('COUNT(payment.id)', 'transactionCount')
      .groupBy(`DATE_TRUNC('${bucket}', sale.createdAt AT TIME ZONE 'America/Lima')`)
      .orderBy(`DATE_TRUNC('${bucket}', sale.createdAt AT TIME ZONE 'America/Lima')`, 'ASC')
      .getRawMany<TrendRow>();

    return rows.map((row) => ({
      date: row.date,
      salesGross: Number(row.salesGross),
      salesNet: Number(row.salesNet),
      commissionsTotal: Number(row.commissionsTotal),
      transactionCount: Number(row.transactionCount),
    }));
  }

  private createPaymentBaseQuery(
    period: ResolvedPeriod,
    paymentMethodIds?: number[],
  ): SelectQueryBuilder<Payment> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.sale', 'sale')
      .innerJoin('payment.paymentMethod', 'method')
      .where('sale.isCanceled = :isCanceled', { isCanceled: false })
      .andWhere('sale.createdAt >= :startDate', { startDate: period.start })
      .andWhere('sale.createdAt <= :endDate', { endDate: period.end });

    if (paymentMethodIds?.length) {
      qb.andWhere('method.id IN (:...paymentMethodIds)', { paymentMethodIds });
    }

    return qb;
  }

  private resolvePeriod(query: BIQuery): ResolvedPeriod {
    if (query.startDate || query.endDate) {
      const start = query.startDate
        ? (resolveRangeStart(query.startDate) ?? new Date('1970-01-01T00:00:00Z'))
        : new Date('1970-01-01T00:00:00Z');
      const end = query.endDate
        ? (resolveRangeEnd(query.endDate) ?? new Date('9999-12-31T23:59:59.999Z'))
        : new Date('9999-12-31T23:59:59.999Z');
      if (start > end) {
        throw new BadRequestException('startDate cannot be greater than endDate');
      }
      return { start, end };
    }

    // Determine today's date in America/Lima (UTC-5, no DST)
    const limaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
      new Date(),
    );
    const [yearStr, monthStr] = limaToday.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based

    const period = query.period ?? 'today';

    if (period === 'week') {
      // Monday-based week in Lima calendar
      const limaDow = new Date(`${limaToday}T12:00:00-05:00`).getDay(); // 0=Sun
      const diffToMonday = limaDow === 0 ? 6 : limaDow - 1;
      const mondayDate = new Date(`${limaToday}T12:00:00-05:00`);
      mondayDate.setDate(mondayDate.getDate() - diffToMonday);
      const mondayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
        mondayDate,
      );
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(mondayDate.getDate() + 6);
      const sundayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
        sundayDate,
      );
      return {
        start: new Date(`${mondayStr}T00:00:00.000-05:00`),
        end: new Date(`${sundayStr}T23:59:59.999-05:00`),
      };
    }

    if (period === 'month') {
      const firstDay = `${yearStr}-${monthStr}-01`;
      const lastDayDate = new Date(year, month, 0); // last day of month
      const lastDay = `${yearStr}-${monthStr}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      return {
        start: new Date(`${firstDay}T00:00:00.000-05:00`),
        end: new Date(`${lastDay}T23:59:59.999-05:00`),
      };
    }

    if (period === 'year') {
      return {
        start: new Date(`${yearStr}-01-01T00:00:00.000-05:00`),
        end: new Date(`${yearStr}-12-31T23:59:59.999-05:00`),
      };
    }

    // Default: today in Lima
    return {
      start: new Date(`${limaToday}T00:00:00.000-05:00`),
      end: new Date(`${limaToday}T23:59:59.999-05:00`),
    };
  }

  private resolveDateBucket(groupBy: string): 'day' | 'week' | 'month' {
    if (groupBy === 'week') return 'week';
    if (groupBy === 'month') return 'month';
    return 'day';
  }
}

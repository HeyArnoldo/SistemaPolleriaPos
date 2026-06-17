import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, DataSource } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { Payment } from '../entities/payment.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Expense } from '../../cash/entities/expense.entity';

/** Parse a YYYY-MM-DD string into a UTC Date range covering that full day in GMT-5 (America/Lima). */
function parseLimaDayRange(dateStr: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestException('Date must have format YYYY-MM-DD');
  }
  // Lima is UTC-5 (no DST). Mirrors the same approach in cash.service.ts.
  const start = new Date(`${dateStr}T00:00:00.000-05:00`);
  const end = new Date(`${dateStr}T23:59:59.999-05:00`);
  return { start, end };
}

@Injectable()
export class SalesResetService {
  constructor(private readonly dataSource: DataSource) {}

  async resetAllFinancialData(): Promise<{
    message: string;
    deleted: { sales: number; payments: number; saleItems: number; expenses: number };
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const saleRepo = queryRunner.manager.getRepository(Sale);
      const paymentRepo = queryRunner.manager.getRepository(Payment);
      const saleItemRepo = queryRunner.manager.getRepository(SaleItem);
      const expenseRepo = queryRunner.manager.getRepository(Expense);

      const deleted = {
        sales: await saleRepo.count(),
        payments: await paymentRepo.count(),
        saleItems: await saleItemRepo.count(),
        expenses: await expenseRepo.count(),
      };

      // Delete in FK-safe order: payments and items before sales, then expenses.
      await paymentRepo.createQueryBuilder().delete().execute();
      await saleItemRepo.createQueryBuilder().delete().execute();
      await saleRepo.createQueryBuilder().delete().execute();
      await expenseRepo.createQueryBuilder().delete().execute();

      await queryRunner.commitTransaction();
      return {
        message: 'Financial data deleted (sales, items, payments, expenses)',
        deleted,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Error resetting all data: ' + (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async resetFinancialDataByDate(date: string): Promise<{
    message: string;
    deleted: {
      sales: number;
      payments: number;
      saleItems: number;
      expenses: number;
      range: { start: Date; end: Date };
    };
  }> {
    const { start, end } = parseLimaDayRange(date);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const saleRepo = queryRunner.manager.getRepository(Sale);
      const paymentRepo = queryRunner.manager.getRepository(Payment);
      const saleItemRepo = queryRunner.manager.getRepository(SaleItem);
      const expenseRepo = queryRunner.manager.getRepository(Expense);

      const sales = await saleRepo.find({
        select: ['id'],
        where: { createdAt: Between(start, end) },
      });
      const saleIds = sales.map((s) => s.id);

      const deleted = {
        sales: saleIds.length,
        payments: 0,
        saleItems: 0,
        expenses: 0,
        range: { start, end },
      };

      if (saleIds.length > 0) {
        const paymentResult = await paymentRepo
          .createQueryBuilder()
          .delete()
          .where('sale_id IN (:...saleIds)', { saleIds })
          .execute();
        const saleItemsResult = await saleItemRepo
          .createQueryBuilder()
          .delete()
          .where('sale_id IN (:...saleIds)', { saleIds })
          .execute();
        const saleResult = await saleRepo
          .createQueryBuilder()
          .delete()
          .where('id IN (:...saleIds)', { saleIds })
          .execute();

        deleted.payments = paymentResult.affected ?? 0;
        deleted.saleItems = saleItemsResult.affected ?? 0;
        deleted.sales = saleResult.affected ?? deleted.sales;
      }

      const expenseResult = await expenseRepo
        .createQueryBuilder()
        .delete()
        .where('created_at BETWEEN :start AND :end', { start, end })
        .execute();
      deleted.expenses = expenseResult.affected ?? 0;

      await queryRunner.commitTransaction();
      return {
        message: 'Financial data deleted for the specified date',
        deleted,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Error resetting data by date: ' + (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }
}

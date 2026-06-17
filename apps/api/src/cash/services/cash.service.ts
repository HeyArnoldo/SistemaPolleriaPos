import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { PaymentMethod } from '../../sales/entities/payment-method.entity';
import { User } from '../../users/user.entity';
import { CreateExpenseDto, SyncExpensesDto } from '../dto/create-expense.dto';

export interface DateRangeFilter {
  from: string;
  to: string;
}

export interface DashboardItem {
  paymentMethodId: number;
  paymentMethodName: string;
  totalExpenses: number;
  count: number;
}

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(PaymentMethod) private readonly pmRepo: Repository<PaymentMethod>,
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
      ...(dto.createdAt ? { createdAt: new Date(dto.createdAt) } : {}),
    });
    return this.expenseRepo.save(expense);
  }

  async syncExpenses(dtos: SyncExpensesDto, createdBy: User): Promise<{ created: number }> {
    let created = 0;
    for (const dto of dtos) {
      await this.createExpense(dto, createdBy);
      created++;
    }
    return { created };
  }

  async findAll(filter: DateRangeFilter): Promise<Expense[]> {
    return this.expenseRepo.find({
      where: {
        createdAt: Between(new Date(filter.from), new Date(filter.to)),
      },
      relations: ['paymentMethod', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDashboard(filter: DateRangeFilter): Promise<DashboardItem[]> {
    const results = await this.expenseRepo
      .createQueryBuilder('expense')
      .innerJoin('expense.paymentMethod', 'pm')
      .select('pm.id', 'paymentMethodId')
      .addSelect('pm.name', 'paymentMethodName')
      .addSelect('SUM(expense.amount)', 'totalExpenses')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.created_at BETWEEN :from AND :to', {
        from: new Date(filter.from),
        to: new Date(filter.to),
      })
      .groupBy('pm.id')
      .addGroupBy('pm.name')
      .getRawMany<{
        paymentMethodId: number;
        paymentMethodName: string;
        totalExpenses: string;
        count: string;
      }>();

    return results.map((r) => ({
      paymentMethodId: r.paymentMethodId,
      paymentMethodName: r.paymentMethodName,
      totalExpenses: parseFloat(r.totalExpenses),
      count: parseInt(r.count, 10),
    }));
  }
}

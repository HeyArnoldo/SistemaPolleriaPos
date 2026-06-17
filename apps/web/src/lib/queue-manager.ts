import { db } from './db';
import type { QueuedSale, QueuedExpense } from '@/types/offline';
import type { CreateSaleDTO, CreateExpenseDTO } from '@/types/models';

export async function enqueueSale(saleNumber: string, payload: CreateSaleDTO): Promise<number> {
  return db.queuedSales.add({
    saleNumber,
    payload,
    ticketData: null,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function enqueueExpense(clientId: string, payload: CreateExpenseDTO): Promise<number> {
  return db.queuedExpenses.add({
    clientId,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingSales(): Promise<QueuedSale[]> {
  return db.queuedSales.where('status').anyOf(['pending', 'failed']).toArray();
}

export async function getPendingExpenses(): Promise<QueuedExpense[]> {
  return db.queuedExpenses.where('status').anyOf(['pending', 'failed']).toArray();
}

export async function markSaleSynced(id: number): Promise<void> {
  await db.queuedSales.update(id, { status: 'synced', syncedAt: new Date().toISOString() });
}

export async function markExpenseSynced(id: number): Promise<void> {
  await db.queuedExpenses.update(id, { status: 'synced', syncedAt: new Date().toISOString() });
}

export async function markSaleFailed(id: number, error: string): Promise<void> {
  const item = await db.queuedSales.get(id);
  await db.queuedSales.update(id, {
    status: 'failed',
    attempts: (item?.attempts ?? 0) + 1,
    lastError: error,
  });
}

export async function markExpenseFailed(id: number, error: string): Promise<void> {
  const item = await db.queuedExpenses.get(id);
  await db.queuedExpenses.update(id, {
    status: 'failed',
    attempts: (item?.attempts ?? 0) + 1,
    lastError: error,
  });
}

export async function countPending(): Promise<number> {
  const sales = await db.queuedSales.where('status').anyOf(['pending', 'failed']).count();
  const expenses = await db.queuedExpenses.where('status').anyOf(['pending', 'failed']).count();
  return sales + expenses;
}

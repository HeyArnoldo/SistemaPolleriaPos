import Dexie, { type Table } from 'dexie';
import type { QueuedSale, QueuedExpense } from '@/types/offline';

class PosDatabase extends Dexie {
  queuedSales!: Table<QueuedSale, number>;
  queuedExpenses!: Table<QueuedExpense, number>;

  constructor() {
    super('pos-db');
    this.version(1).stores({
      queuedSales: '++id, status, createdAt',
      queuedExpenses: '++id, clientId, status, createdAt',
    });
  }
}

export const db = new PosDatabase();

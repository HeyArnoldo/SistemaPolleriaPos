import Dexie, { type Table } from 'dexie';
import type { QueuedSale, QueuedExpense } from '@/types/offline';

export interface StoredOfflineSession {
  id?: number;
  userId: number;
  role: string;
  username: string;
  displayName: string;
  pinHash: string;
}

class PosDatabase extends Dexie {
  queuedSales!: Table<QueuedSale, number>;
  queuedExpenses!: Table<QueuedExpense, number>;
  offlineSession!: Table<StoredOfflineSession, number>;

  constructor() {
    super('pos-db');
    this.version(1).stores({
      queuedSales: '++id, status, createdAt',
      queuedExpenses: '++id, clientId, status, createdAt',
    });
    this.version(2).stores({
      queuedSales: '++id, status, createdAt',
      queuedExpenses: '++id, clientId, status, createdAt',
      offlineSession: '++id, userId',
    });
  }
}

export const db = new PosDatabase();

import type { CreateExpenseDTO, CreateSaleDTO } from './models';

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type SyncFailure = {
  id?: string;
  saleNumber?: string;
  receiptNumber?: string;
  error: string;
};

export type SyncResult = {
  success: number;
  skipped: number;
  failed: SyncFailure[];
  message: string;
};

export type QueuedSale = {
  id?: number;
  saleNumber: string;
  payload: CreateSaleDTO;
  ticketData: unknown;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
};

export type QueuedExpense = {
  id?: number;
  clientId: string;
  receiptNumber?: string;
  payload: CreateExpenseDTO;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
};

import { api } from '@/lib/api';
import type { CashDashboardResponse, CreateExpenseDTO, Expense } from '@/types/models';
import type { SyncResult } from '@/types/offline';

export const getCashDashboard = async (params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<CashDashboardResponse> => {
  const { data } = await api.get('/cash/dashboard', { params });
  return data;
};

export const getExpenses = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Expense[]> => {
  const { data } = await api.get('/cash/expenses', { params });
  return data;
};

export const createExpense = async (payload: CreateExpenseDTO): Promise<Expense> => {
  const { data } = await api.post('/cash/expenses', payload);
  return data;
};

export const deleteExpense = async (id: number): Promise<void> => {
  await api.delete(`/cash/expenses/${id}`);
};

export const syncExpenses = async (payload: {
  expenses: CreateExpenseDTO[];
}): Promise<SyncResult> => {
  const { data } = await api.post('/cash/expenses/sync', payload);
  return data;
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as cashApi from '@/services/cash.api';
import { QUERY_KEYS } from './query-keys';
import type { CreateExpenseDTO } from '@/types/models';

export const useGetCashDashboard = (date?: string) =>
  useQuery({
    queryKey: QUERY_KEYS.cashDashboard(date),
    queryFn: () => cashApi.getCashDashboard(date ? { date } : undefined),
    refetchInterval: 15_000,
  });

export const useGetExpenses = (params?: { startDate?: string; endDate?: string }) =>
  useQuery({
    queryKey: QUERY_KEYS.expenses(params),
    queryFn: () => cashApi.getExpenses(params),
  });

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpenseDTO) => cashApi.createExpense(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-dashboard'] });
    },
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cashApi.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-dashboard'] });
    },
  });
};

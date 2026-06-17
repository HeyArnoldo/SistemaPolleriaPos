import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as salesApi from '@/services/sales.api';
import { QUERY_KEYS } from './query-keys';
import type { CancelSaleDTO, CreateSaleDTO } from '@/types/models';

export const useGetSales = () =>
  useQuery({ queryKey: QUERY_KEYS.sales, queryFn: salesApi.getSales });

export const useCreateSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaleDTO) => salesApi.createSale(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    },
  });
};

export const useCancelSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CancelSaleDTO }) =>
      salesApi.cancelSale(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    },
  });
};

export const useExportCashReport = () =>
  useMutation({
    mutationFn: (params: { startDate: string; endDate: string }) =>
      salesApi.exportCashReport(params),
  });

export const useResetSalesAll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => salesApi.resetSalesAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    },
  });
};

export const useResetSalesByDate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => salesApi.resetSalesByDate(date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    },
  });
};

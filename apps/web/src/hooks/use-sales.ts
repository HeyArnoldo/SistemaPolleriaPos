import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as salesApi from '@/services/sales.api';
import type { GetSalesFilter } from '@/services/sales.api';
import { QUERY_KEYS, invalidateFinancialQueries } from './query-keys';
import type { CancelSaleDTO, CreateSaleDTO } from '@/types/models';

export const useGetSales = (filter?: GetSalesFilter) =>
  useQuery({
    queryKey: [...QUERY_KEYS.sales, filter],
    queryFn: () => salesApi.getSales(filter),
  });

export const useCreateSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaleDTO) => salesApi.createSale(payload),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
};

export const useCancelSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CancelSaleDTO }) =>
      salesApi.cancelSale(id, payload),
    onSuccess: () => invalidateFinancialQueries(qc),
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
    onSuccess: () => invalidateFinancialQueries(qc),
  });
};

export const useResetSalesByDate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => salesApi.resetSalesByDate(date),
    onSuccess: () => invalidateFinancialQueries(qc),
  });
};

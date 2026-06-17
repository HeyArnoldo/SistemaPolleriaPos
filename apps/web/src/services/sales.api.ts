import { api } from '@/lib/api';
import type { CancelSaleDTO, CreateSaleDTO, Sale } from '@/types/models';
import type { SyncResult } from '@/types/offline';

export interface GetSalesFilter {
  from?: string;
  to?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

export const createSale = async (payload: CreateSaleDTO): Promise<Sale> => {
  const { data } = await api.post('/sales', payload);
  return data;
};

export const getSales = async (filter?: GetSalesFilter): Promise<Sale[]> => {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  if (filter?.userId !== undefined) params.set('userId', String(filter.userId));
  if (filter?.page !== undefined) params.set('page', String(filter.page));
  if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
  const query = params.toString();
  const { data } = await api.get<{ data: Sale[]; total: number }>(
    `/sales${query ? `?${query}` : ''}`,
  );
  return data.data;
};

export const getSale = async (id: number): Promise<Sale> => {
  const { data } = await api.get(`/sales/${id}`);
  return data;
};

export const cancelSale = async (id: number, payload: CancelSaleDTO): Promise<Sale> => {
  const { data } = await api.patch(`/sales/${id}/cancel`, payload);
  return data;
};

export const syncSales = async (payload: { sales: CreateSaleDTO[] }): Promise<SyncResult> => {
  const { data } = await api.post('/sales/sync', payload);
  return data;
};

export const resetSalesAll = async (): Promise<void> => {
  await api.delete('/sales/reset/all');
};

export const resetSalesByDate = async (date: string): Promise<void> => {
  await api.delete(`/sales/reset/date/${date}`);
};

export const exportCashReport = async (params: {
  startDate: string;
  endDate: string;
}): Promise<{ blob: Blob; filename: string }> => {
  const response = await api.get('/sales/export/cash-report', {
    params,
    responseType: 'blob',
  });
  const disposition = response.headers?.['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? 'reporte-caja.xlsx';
  return { blob: response.data as Blob, filename };
};

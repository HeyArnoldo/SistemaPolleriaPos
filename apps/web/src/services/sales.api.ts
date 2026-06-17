import { api } from '@/lib/api';
import type { CancelSaleDTO, CreateSaleDTO, Sale } from '@/types/models';
import type { SyncResult } from '@/types/offline';

export const createSale = async (payload: CreateSaleDTO): Promise<Sale> => {
  const { data } = await api.post('/sales', payload);
  return data;
};

export const getSales = async (): Promise<Sale[]> => {
  const { data } = await api.get('/sales');
  return data;
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

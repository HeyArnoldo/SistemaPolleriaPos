import { api } from '@/lib/api';
import type { PaymentMethod } from '@/types/models';

export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data } = await api.get('/sales/payment-methods');
  return data;
};

export const createPaymentMethod = async (payload: {
  name: string;
  commissionPercentage?: number;
  requiresTransferTime?: boolean;
}): Promise<PaymentMethod> => {
  const { data } = await api.post('/sales/payment-methods', payload);
  return data;
};

export const updatePaymentMethod = async (
  id: number,
  payload: Partial<{
    name: string;
    commissionPercentage: number;
    requiresTransferTime: boolean;
    isActive: boolean;
  }>,
): Promise<PaymentMethod> => {
  const { data } = await api.patch(`/sales/payment-methods/${id}`, payload);
  return data;
};

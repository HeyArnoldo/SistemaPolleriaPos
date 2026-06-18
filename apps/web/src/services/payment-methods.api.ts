import { api } from '@/lib/api';
import type { PaymentMethod } from '@/types/models';

// commissionPercentage is a decimal serialized as a string by the API; coerce
// it so the declared number type holds at runtime (commission math).
const normalizePaymentMethod = (pm: PaymentMethod): PaymentMethod => ({
  ...pm,
  commissionPercentage: Number(pm.commissionPercentage),
});

// Checkout (Ventas/Egresos) must only offer ACTIVE methods.
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data } = await api.get('/payment-methods/active');
  return (data as PaymentMethod[]).map(normalizePaymentMethod);
};

export const createPaymentMethod = async (payload: {
  name: string;
  commissionPercentage?: number;
  requiresTransferTime?: boolean;
}): Promise<PaymentMethod> => {
  const { data } = await api.post('/payment-methods', payload);
  return normalizePaymentMethod(data as PaymentMethod);
};

// Configuración needs ALL methods (active + inactive) to manage them.
export const getAllPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const { data } = await api.get('/payment-methods');
  return (data as PaymentMethod[]).map(normalizePaymentMethod);
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
  const { data } = await api.patch(`/payment-methods/${id}`, payload);
  return normalizePaymentMethod(data as PaymentMethod);
};

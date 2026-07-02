/**
 * Carbopuntos API service — all calls go through apps/api (/api/carbopuntos/*),
 * never directly to the hub. Authentication and service-key forwarding are
 * handled by the backend proxy controller (WU-6a).
 */
import { api } from '@/lib/api';
import type { Customer, PointsMovement } from '@app/carbopuntos-contracts';

// ─── Customer endpoints ───────────────────────────────────────────────────────

export interface CustomerListResult {
  items: (Customer & { balance: number })[];
  total: number;
}

export interface ListCustomersParams {
  limit?: number;
  offset?: number;
}

/**
 * Fetches a paginated list of all customers with embedded balances.
 * Used by the admin "Clientes" page to show customers without a search query.
 */
export const listCustomers = async (
  params: ListCustomersParams = {},
): Promise<CustomerListResult> => {
  const { data } = await api.get<CustomerListResult>('/carbopuntos/customers', { params });
  return data;
};

export const searchCustomers = async (q: string): Promise<(Customer & { balance: number })[]> => {
  const { data } = await api.get<(Customer & { balance: number })[]>(
    '/carbopuntos/customers/search',
    { params: { q } },
  );
  return data;
};

export interface CustomerWithBalance {
  dni: string;
  balance: number;
  customer: Customer | null;
}

export const getCustomer = async (dni: string): Promise<CustomerWithBalance> => {
  const { data } = await api.get<CustomerWithBalance>(`/carbopuntos/customers/${dni}`);
  return data;
};

export const getCustomerHistory = async (dni: string): Promise<PointsMovement[]> => {
  const { data } = await api.get<PointsMovement[]>(`/carbopuntos/customers/${dni}/history`);
  return data;
};

export interface AffiliateCustomerPayload {
  dni: string;
  phone?: string;
  consentAt: string;
}

export const affiliateCustomer = async (payload: AffiliateCustomerPayload): Promise<Customer> => {
  const { data } = await api.post<Customer>('/carbopuntos/customers', payload);
  return data;
};

// Balance is read from GET /carbopuntos/customers/:dni (see getCustomer), which
// already returns the embedded balance. There is no separate /:dni/balance
// endpoint on the proxy, so no dedicated balance fetcher exists here.

// ─── Admin operations ─────────────────────────────────────────────────────────

export interface AdjustPointsPayload {
  points: number;
  reason: string;
}

export const adjustPoints = async (
  dni: string,
  payload: AdjustPointsPayload,
): Promise<PointsMovement> => {
  const { data } = await api.post<PointsMovement>(`/carbopuntos/customers/${dni}/adjust`, payload);
  return data;
};

export const voidMovement = async (movementId: string, reason: string): Promise<PointsMovement> => {
  const { data } = await api.post<PointsMovement>(`/carbopuntos/movements/${movementId}/void`, {
    reason,
  });
  return data;
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as carbopuntosApi from '@/services/carbopuntos.api';
import { QUERY_KEYS } from './query-keys';

// ─── Lookup / search ──────────────────────────────────────────────────────────

export const useSearchCustomers = (q: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.customers(q),
    queryFn: () => carbopuntosApi.searchCustomers(q),
    enabled: enabled && q.length >= 1,
    staleTime: 30_000,
  });

/**
 * Fetches the customer record + current point balance for a given DNI.
 * Returns { dni, balance, customer } — customer may be null if the DNI is not found.
 * Used by CustomerPanel to display the name and seed the balance on linking.
 */
export const useGetCustomer = (dni: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.customer(dni),
    queryFn: () => carbopuntosApi.getCustomer(dni),
    enabled: enabled && dni.length === 8,
    staleTime: 30_000,
    retry: false,
  });

export const useGetCustomerHistory = (dni: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.customerHistory(dni),
    queryFn: () => carbopuntosApi.getCustomerHistory(dni),
    enabled: enabled && dni.length === 8,
    staleTime: 15_000,
  });

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useAffiliateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: carbopuntosApi.AffiliateCustomerPayload) =>
      carbopuntosApi.affiliateCustomer(payload),
    onSuccess: (customer) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers() });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customer(customer.dni) });
    },
  });
};

export const useAdjustPoints = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dni, payload }: { dni: string; payload: carbopuntosApi.AdjustPointsPayload }) =>
      carbopuntosApi.adjustPoints(dni, payload),
    onSuccess: (_result, { dni }) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customer(dni) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customerHistory(dni) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customerBalance(dni) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers() });
    },
  });
};

export const useVoidMovement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, reason }: { movementId: string; reason: string }) =>
      carbopuntosApi.voidMovement(movementId, reason),
    onSuccess: () => {
      // Invalidate all customer-related queries since we don't know which customer
      void qc.invalidateQueries({ queryKey: ['carbopuntos-customer'] });
      void qc.invalidateQueries({ queryKey: ['carbopuntos-customer-history'] });
      void qc.invalidateQueries({ queryKey: ['carbopuntos-customer-balance'] });
      void qc.invalidateQueries({ queryKey: ['carbopuntos-customers'] });
    },
  });
};

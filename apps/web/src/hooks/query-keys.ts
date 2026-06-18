import type { QueryClient } from '@tanstack/react-query';

export const QUERY_KEYS = {
  sales: ['sales'] as const,
  sale: (id: number) => ['sales', id] as const,
  products: ['products'] as const,
  product: (id: number) => ['products', id] as const,
  categories: ['categories'] as const,
  paymentMethods: ['payment-methods'] as const,
  cashDashboard: (date?: string) => ['cash-dashboard', date] as const,
  expenses: (params?: object) => ['expenses', params] as const,
  users: ['users'] as const,
  settings: ['settings'] as const,
  biSummary: (params?: object) => ['bi-summary', params] as const,
  biDetail: (params?: object) => ['bi-detail', params] as const,
  biCommissions: (params?: object) => ['bi-commissions', params] as const,
  biTrends: (params?: object) => ['bi-trends', params] as const,
  // Carbopuntos
  customers: (q?: string) => ['carbopuntos-customers', q] as const,
  customer: (dni: string) => ['carbopuntos-customer', dni] as const,
  customerHistory: (dni: string) => ['carbopuntos-customer-history', dni] as const,
  customerBalance: (dni: string) => ['carbopuntos-customer-balance', dni] as const,
  rewards: ['carbopuntos-rewards'] as const,
} as const;

/**
 * Every read that depends on sales/expenses data. A sale or expense mutation
 * must invalidate all of these so the dashboard, caja, BI and lists refresh in
 * real time (not just the sales/expenses list that triggered the change).
 */
export const FINANCIAL_QUERY_ROOTS = [
  ['sales'],
  ['expenses'],
  ['cash-dashboard'],
  ['bi-summary'],
  ['bi-detail'],
  ['bi-commissions'],
  ['bi-trends'],
] as const;

export function invalidateFinancialQueries(qc: QueryClient): void {
  for (const queryKey of FINANCIAL_QUERY_ROOTS) {
    void qc.invalidateQueries({ queryKey: [...queryKey] });
  }
}

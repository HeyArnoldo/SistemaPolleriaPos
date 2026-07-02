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
  customersList: () => ['carbopuntos-customers-list'] as const,
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

/**
 * Invalidates every read that depends on a customer's points after an adjust or
 * void mutation: the detail panel, the cross-sede history, the balance, the
 * search results AND the admin list. The list uses a distinct key
 * (`carbopuntos-customers-list`) that is NOT prefix-matched by the search key
 * (`carbopuntos-customers`), so it must be invalidated explicitly or the table
 * keeps showing a stale balance that diverges from the detail view.
 */
export function invalidateCustomerPointsQueries(qc: QueryClient, dni?: string): void {
  if (dni) {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.customer(dni) });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.customerHistory(dni) });
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.customerBalance(dni) });
  } else {
    void qc.invalidateQueries({ queryKey: ['carbopuntos-customer'] });
    void qc.invalidateQueries({ queryKey: ['carbopuntos-customer-history'] });
    void qc.invalidateQueries({ queryKey: ['carbopuntos-customer-balance'] });
  }
  // Usamos la raíz literal `['carbopuntos-customers']` (no `QUERY_KEYS.customers()`,
  // que devuelve `['carbopuntos-customers', undefined]`): el trailing `undefined`
  // hace que partialMatchKey compare el índice 1 contra el dni real del query de
  // búsqueda y NO matchee, dejando los resultados de búsqueda sin invalidar.
  void qc.invalidateQueries({ queryKey: ['carbopuntos-customers'] });
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customersList() });
}

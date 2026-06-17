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
} as const;

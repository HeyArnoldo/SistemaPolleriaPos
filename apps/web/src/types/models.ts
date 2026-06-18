import type { UserRole } from '@app/contracts';

export interface ProductCategory {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: ProductCategory;
}

export interface PaymentMethod {
  id: number;
  name: string;
  commissionPercentage: number;
  requiresTransferTime: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleItemDTO {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface CreatePaymentDTO {
  paymentMethodId: number;
  amount: number;
  transferTime?: string;
}

export interface CreateSaleDTO {
  items: CreateSaleItemDTO[];
  payments: CreatePaymentDTO[];
  notes?: string;
  saleNumber?: string;
  createdAt?: string;
}

export interface CancelSaleDTO {
  reason: string;
}

export interface SaleItem {
  id?: number;
  productId: number;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  product?: Product;
}

export interface SalePayment {
  id?: number;
  paymentMethodId: number;
  amount: number;
  grossAmount?: number;
  netAmount?: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  transferTime?: string;
  paymentMethod?: PaymentMethod;
}

export interface Sale {
  id: number;
  saleNumber?: string;
  items: SaleItem[];
  payments: SalePayment[];
  notes?: string;
  subtotal?: number | string;
  totalAmount?: number | string;
  taxAmount?: number | string;
  paymentStatus?: string;
  isCanceled?: boolean;
  cancelReason?: string;
  canceledAt?: string;
  createdAt: string;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  receiptNumber?: string;
  paymentMethodId?: number;
  paymentMethod?: PaymentMethod;
  createdAt: string;
}

export interface CreateExpenseDTO {
  description: string;
  amount: number;
  receiptNumber?: string;
  paymentMethodId: number;
  createdAt?: string;
}

export interface UserProfile {
  id?: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface User {
  id: number;
  username: string;
  isActive: boolean;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  profile?: UserProfile;
}

export interface CreateUserDTO {
  username: string;
  password: string;
  role?: UserRole;
  profile: { firstName: string; lastName: string };
}

export interface UpdateUserDTO {
  username?: string;
  password?: string;
  role?: UserRole;
  profile?: { firstName?: string; lastName?: string };
}

export interface CashDashboardSummaryRow {
  paymentMethodId: number;
  paymentMethodName: string;
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  expensesTotal: number;
  netTotal: number;
}

export interface CashDashboardTotals {
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  expensesTotal: number;
  netTotal: number;
}

export interface CashDashboardTransaction {
  type: 'sale' | 'expense';
  concept?: string;
  saleNumber?: string | null;
  description?: string | null;
  paymentMethodId: number;
  paymentMethodName: string;
  amount: number;
  grossAmount: number;
  netAmount: number;
  commissionAmount: number;
  createdAt: string;
}

export interface CashDashboardResponse {
  summary: CashDashboardSummaryRow[];
  totals: CashDashboardTotals;
  transactions: CashDashboardTransaction[];
}

export interface StoreSetting {
  id: number;
  storeName: string;
  createdAt: string;
  updatedAt: string;
}

// BI Analytics types

export type BIPeriod = 'today' | 'week' | 'month' | 'year';
export type BIGroupBy = 'day' | 'week' | 'month';

export interface BIQueryParams {
  startDate?: string;
  endDate?: string;
  period?: BIPeriod;
  groupBy?: BIGroupBy;
  paymentMethodIds?: number[];
  page?: number;
  limit?: number;
}

export interface BISummaryRow {
  paymentMethodId: number;
  paymentMethodName: string;
  commissionPercentage: number;
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  transactionCount: number;
  averageTicket: number;
}

export interface BITrendRow {
  date: string;
  salesGross: number;
  salesNet: number;
  commissionsTotal: number;
  transactionCount: number;
}

export interface BISummaryTotals {
  totalSalesGross: number;
  totalSalesNet: number;
  totalCommissions: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
}

export interface BISummaryPeriod {
  start: string;
  end: string;
}

export interface BISummaryResponse {
  period: BISummaryPeriod;
  summary: BISummaryTotals;
  byPaymentMethod: BISummaryRow[];
  trend: BITrendRow[];
}

export interface BIDetailTransaction {
  id: number;
  saleNumber: string;
  date: string;
  paymentMethodId: number;
  paymentMethodName: string;
  grossAmount: number;
  netAmount: number;
  commissionAmount: number;
  commissionPercentage: number;
}

export interface BIPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BIDetailResponse {
  transactions: BIDetailTransaction[];
  pagination: BIPagination;
}

export interface BICommissionsRow {
  paymentMethodId: number;
  paymentMethodName: string;
  commissionPercentage: number;
  commissionsTotal: number;
}

export interface BICommissionsResponse {
  period: BISummaryPeriod;
  totalCommissions: number;
  byPaymentMethod: BICommissionsRow[];
}

// Electron IPC bridge — defined only when running inside the desktop app
declare global {
  interface Window {
    electronAPI?: {
      /** API base URL configured for this device (Electron fat client). */
      apiUrl?: string;
      printTicket: (
        html: string,
        options?: { printerName?: string; marginsType?: number },
      ) => Promise<void>;
      getPrinters?: () => Promise<{ name: string; displayName?: string }[]>;
      saveConfig: (apiUrl: string) => Promise<void>;
      /** Re-open the branch setup window to change the configured API URL. */
      openSetup?: () => Promise<void>;
    };
  }
}

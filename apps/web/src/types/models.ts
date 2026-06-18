import type { UserRole, CreateSaleInput, RedemptionItemInput } from '@app/contracts';

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
  /** Points earned when this product is sold. 0 or null means no points. */
  puntaje?: number | null;
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

/**
 * A redemption entry as recorded in a sale. Shape is the contract source of
 * truth (redemptionItemSchema): { description, costPoints }. Sending the wrong
 * shape is now a compile error (see CreateSaleDTO).
 */
export type SaleRedemption = RedemptionItemInput;

/**
 * Sale creation payload. Derived from the Zod contract (createSaleSchema) so the
 * web payload can NEVER drift from server validation — a mismatched shape is a
 * COMPILE ERROR. Notably this enforces `customerDni` (camelCase) and the
 * `{ description, costPoints }` redemption shape. `createdAt` is widened to also
 * accept an ISO string (the contract coerces it server-side).
 */
export type CreateSaleDTO = Omit<CreateSaleInput, 'createdAt'> & {
  createdAt?: string;
};

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
  /** DNI of the linked customer (if any). */
  customer_dni?: string | null;
  /** Carbopuntos data returned after the sale is registered. */
  carbopuntos?: {
    customerName?: string;
    pointsBefore?: number;
    pointsEarned?: number;
    pointsRedeemed?: number;
    pointsAfter?: number;
    /** True when the hub was unreachable and the accrual was queued for later sync. */
    pending?: boolean;
    redemptions?: SaleRedemption[];
  } | null;
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

// Live auto-update status pushed from the Electron main process.
export interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
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
      /** Subscribe to "update downloaded"; returns an unsubscribe function. */
      onUpdateDownloaded?: (callback: (info: { version?: string }) => void) => () => void;
      /** Quit and install a downloaded update. */
      restartToUpdate?: () => Promise<void>;
      /** Installed app version (e.g. "0.1.4"). */
      getAppVersion?: () => Promise<string>;
      /** Trigger a manual update check; results stream via onUpdateStatus. */
      checkForUpdates?: () => Promise<void>;
      /** Subscribe to live update status; returns an unsubscribe function. */
      onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
    };
  }
}

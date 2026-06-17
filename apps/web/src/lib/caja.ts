import type { Sale, SalePayment, Expense } from '@/types/models';

export { formatCurrency, formatTime, parseAmount } from '@/lib/formatting';

export const getSaleTotal = (sale: Sale): number => {
  if (sale.totalAmount !== undefined && sale.totalAmount !== null) {
    return typeof sale.totalAmount === 'string' ? parseFloat(sale.totalAmount) : sale.totalAmount;
  }
  if (sale.payments && sale.payments.length > 0) {
    return sale.payments.reduce((sum, p) => {
      const amt = p.grossAmount ?? p.amount;
      return sum + (typeof amt === 'number' ? amt : parseFloat(String(amt)) || 0);
    }, 0);
  }
  if (sale.items && sale.items.length > 0) {
    return sale.items.reduce((sum, item) => {
      const price =
        typeof item.unitPrice === 'number'
          ? item.unitPrice
          : parseFloat(String(item.unitPrice)) || 0;
      return sum + price * item.quantity;
    }, 0);
  }
  return 0;
};

export type SaleStatus = 'active' | 'cancelled';

export const getSaleStatus = (sale: Sale): SaleStatus => {
  if (sale.isCanceled || sale.canceledAt || sale.cancelReason) return 'cancelled';
  return 'active';
};

export const saleIsCancelled = (sale: Sale): boolean => getSaleStatus(sale) !== 'active';

export const getPaymentDisplayName = (payment: SalePayment): string => {
  if (payment.paymentMethod?.name) return payment.paymentMethod.name;
  if (payment.paymentMethodId) return `Metodo #${payment.paymentMethodId}`;
  return 'Desconocido';
};

export const getSalePaymentLabel = (sale: Sale): string => {
  if (!sale.payments || sale.payments.length === 0) return '';
  return sale.payments.map(getPaymentDisplayName).join(', ');
};

export const getTransferTimeSummary = (sale: Sale): string => {
  if (!sale.payments) return '';
  const times = sale.payments.filter((p) => p.transferTime).map((p) => p.transferTime as string);
  return times.join(', ');
};

export const getExpensePaymentName = (expense: Expense): string => {
  if (expense.paymentMethod?.name) return expense.paymentMethod.name;
  if (expense.paymentMethodId) return `Metodo #${expense.paymentMethodId}`;
  return 'Sin metodo';
};

export const groupExpensesByDate = (expenses: Expense[]): Record<string, Expense[]> => {
  const groups: Record<string, Expense[]> = {};
  for (const expense of expenses) {
    const date = expense.createdAt.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(expense);
  }
  const sorted: Record<string, Expense[]> = {};
  for (const key of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    sorted[key] = groups[key];
  }
  return sorted;
};

export const groupSalesByDate = (sales: Sale[]): Record<string, Sale[]> => {
  const groups: Record<string, Sale[]> = {};
  for (const sale of sales) {
    const date = sale.createdAt.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(sale);
  }
  const sorted: Record<string, Sale[]> = {};
  for (const key of Object.keys(groups).sort((a, b) => b.localeCompare(a))) {
    sorted[key] = groups[key];
  }
  return sorted;
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const formatDateLabel = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayName = DAYS_ES[date.getDay()];
  const monthName = MONTHS_ES[date.getMonth()];
  return `${dayName}, ${day} de ${monthName} ${year}`;
};

export const getDayTotals = (
  sales: Sale[],
): { count: number; total: number; cancelledCount: number } => {
  let total = 0;
  let cancelledCount = 0;
  for (const sale of sales) {
    if (saleIsCancelled(sale)) {
      cancelledCount++;
    } else {
      total += getSaleTotal(sale);
    }
  }
  return { count: sales.length, total, cancelledCount };
};

export const getDayExpensesTotal = (expenses: Expense[]): number => {
  return expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
};

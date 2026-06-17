import { z } from 'zod';

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(255),
  amount: z.number().min(0),
  receiptNumber: z.string().max(100).optional(),
  paymentMethodId: z.number().int().positive(),
  createdAt: z.coerce.date().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const syncExpensesSchema = z.object({
  expenses: z.array(createExpenseSchema).max(50),
});
export type SyncExpensesInput = z.infer<typeof syncExpensesSchema>;

export const cashDashboardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
});
export type CashDashboardQuery = z.infer<typeof cashDashboardQuerySchema>;

import { z } from 'zod';

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  receiptNumber: z.string().max(100).optional().nullable(),
  paymentMethodId: z.number().int().positive(),
  createdAt: z.string().datetime().optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const syncExpensesSchema = z.array(createExpenseSchema).min(1).max(100);
export type SyncExpensesDto = z.infer<typeof syncExpensesSchema>;

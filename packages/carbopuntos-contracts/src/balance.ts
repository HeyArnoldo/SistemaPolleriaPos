import { z } from 'zod';

// Current balance for a customer — balance is always non-negative at schema level.
export const balanceSchema = z.object({
  customerId: z.string().uuid(),
  balance: z.number().int().min(0, 'Balance must be non-negative'),
  version: z.number().int().min(0),
  updatedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString())),
});
export type Balance = z.infer<typeof balanceSchema>;

// Projected balance shown to the cashier before confirming the transaction.
// All fields non-negative at schema level; business logic enforces the projection.
export const projectedBalanceSchema = z.object({
  customerId: z.string().uuid(),
  currentBalance: z.number().int().min(0),
  accrual: z.number().int().min(0),
  redemption: z.number().int().min(0),
  projectedBalance: z.number().int().min(0, 'Projected balance must be non-negative'),
});
export type ProjectedBalance = z.infer<typeof projectedBalanceSchema>;

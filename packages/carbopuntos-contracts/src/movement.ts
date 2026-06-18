import { z } from 'zod';

export const movementTypeSchema = z.enum(['accrual', 'redeem', 'adjustment', 'reversal']);
export type MovementType = z.infer<typeof movementTypeSchema>;

// Immutable record of a points movement — stored in the hub.
// Points may arrive as strings from TypeORM (decimal columns), so z.coerce.number() is used.
export const pointsMovementSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  type: movementTypeSchema,
  // Accepts string (TypeORM decimal serialization) and converts to number.
  points: z.coerce.number().int(),
  balanceBefore: z.coerce.number().int().min(0),
  balanceAfter: z.coerce.number().int().min(0),
  sede: z.string().min(1),
  userRef: z.string().min(1),
  saleRef: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  isVoided: z.boolean().default(false),
  voidedBy: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  voidReason: z.string().nullable().optional(),
  createdAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString())),
});
export type PointsMovement = z.infer<typeof pointsMovementSchema>;

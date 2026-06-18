import { z } from 'zod';

const dniPattern = /^[0-9]{8}$/;

// Accrue points for a customer after a sale.
// idempotencyKey is REQUIRED to prevent double-accrual on retries.
export const accrueSchema = z.object({
  customerDni: z.string().regex(dniPattern),
  // Accepts string from TypeORM; must be a positive integer.
  points: z.coerce.number().int().positive(),
  saleRef: z.string().optional(),
  userRef: z.string().min(1),
  detail: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type AccrueInput = z.infer<typeof accrueSchema>;

// Redeem points for a reward.
// idempotencyKey is REQUIRED to prevent double-redemption on retries.
export const redeemSchema = z.object({
  customerDni: z.string().regex(dniPattern),
  points: z.coerce.number().int().positive(),
  saleRef: z.string().optional(),
  userRef: z.string().min(1),
  detail: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type RedeemInput = z.infer<typeof redeemSchema>;

// Mixed operation: accrue + redeem in a single atomic transaction.
// idempotencyKey is REQUIRED.
export const mixedOperationSchema = z.object({
  customerDni: z.string().regex(dniPattern),
  accrualPoints: z.coerce.number().int().min(0),
  redemptionPoints: z.coerce.number().int().min(0),
  saleRef: z.string().optional(),
  userRef: z.string().min(1),
  detail: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type MixedOperationInput = z.infer<typeof mixedOperationSchema>;

// Reverse the points accrued for a specific sale (e.g., on sale cancellation).
// idempotencyKey is REQUIRED.
export const reverseSchema = z.object({
  customerDni: z.string().regex(dniPattern),
  saleRef: z.string().min(1),
  userRef: z.string().min(1),
  detail: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type ReverseInput = z.infer<typeof reverseSchema>;

// Manual balance adjustment performed by an admin.
// reason is REQUIRED (audit trail, D8).
// idempotencyKey is NOT required (admin operation, no retry risk).
// Negative deltas are allowed (admin can reduce a balance), but the resulting
// balance can NEVER go below zero: an adjustment that would leave it negative is
// BLOCKED at the service level (D6). Validation here only checks the delta is an integer.
export const adjustSchema = z.object({
  customerDni: z.string().regex(dniPattern),
  points: z.coerce.number().int(),
  reason: z.string().min(1, 'Reason is required for manual adjustments'),
  userRef: z.string().min(1),
  detail: z.string().optional(),
});
export type AdjustInput = z.infer<typeof adjustSchema>;

// Soft-delete (void) a movement. Triggers balance recalculation.
export const voidMovementSchema = z.object({
  movementId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required to void a movement'),
  userRef: z.string().min(1),
});
export type VoidMovementInput = z.infer<typeof voidMovementSchema>;

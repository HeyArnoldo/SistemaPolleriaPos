import { z } from 'zod';

export const createSaleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  // Decimals serialize as strings (TypeORM), so accept numeric strings too.
  unitPrice: z.coerce.number().positive(),
});
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;

export const createPaymentSchema = z.object({
  paymentMethodId: z.number().int().positive(),
  amount: z.coerce.number().min(0),
  transferTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato HH:mm o HH:mm:ss')
    .optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// A reward being redeemed in this sale. costPoints is the hub-debit amount; description
// is passed to the hub as the movement detail. The reward lives locally (D2); only the
// debit is recorded in the hub.
export const redemptionItemSchema = z.object({
  description: z.string().min(1, 'Redemption description is required'),
  costPoints: z.number().int().positive('costPoints must be a positive integer'),
});
export type RedemptionItemInput = z.infer<typeof redemptionItemSchema>;

export const createSaleSchema = z
  .object({
    // items is relaxed to allow empty arrays ONLY when redemptions are present.
    // The .superRefine below enforces the combined constraint.
    items: z.array(createSaleItemSchema),
    payments: z.array(createPaymentSchema),
    notes: z.string().max(500).optional(),
    saleNumber: z.string().max(32).optional(),
    createdAt: z.coerce.date().optional(),
    // Weak reference to hub customer — no FK (D20). 8-digit DNI or absent for anonymous sales.
    customerDni: z
      .string()
      .regex(/^[0-9]{8}$/, 'customer_dni must be exactly 8 digits')
      .optional(),
    // Rewards being redeemed in this sale (optional). Requires customerDni (D1).
    // costPoints is deducted from the customer's hub balance. Does NOT affect the
    // monetary total in soles (D4).
    redemptions: z.array(redemptionItemSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const hasRedemptions = data.redemptions && data.redemptions.length > 0;
    const hasItems = data.items.length > 0;
    // An empty cart is only allowed when there are redemptions and a customer (F5: solo canje).
    if (!hasItems && !hasRedemptions) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one item is required when no redemptions are present',
        path: ['items'],
      });
    }
    // Redemptions always require a customer DNI (D1 — canje requires hub online + customer).
    if (hasRedemptions && !data.customerDni) {
      ctx.addIssue({
        code: 'custom',
        message: 'customerDni is required when redemptions are present',
        path: ['customerDni'],
      });
    }
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const syncSalesSchema = z.object({
  sales: z.array(createSaleSchema).max(50),
});
export type SyncSalesInput = z.infer<typeof syncSalesSchema>;

export const cancelSaleSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1).max(100),
  commissionPercentage: z.number().min(0).max(100).default(0),
  requiresTransferTime: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial();
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

export const paymentMethodSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  commissionPercentage: z.number(),
  requiresTransferTime: z.boolean(),
  isActive: z.boolean(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

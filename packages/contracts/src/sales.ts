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

export const createSaleSchema = z.object({
  items: z.array(createSaleItemSchema).min(1),
  payments: z.array(createPaymentSchema).min(1),
  notes: z.string().max(500).optional(),
  saleNumber: z.string().max(32).optional(),
  createdAt: z.coerce.date().optional(),
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

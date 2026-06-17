import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

export const salePaymentSchema = z.object({
  paymentMethodId: z.number().int().positive(),
  amount: z.number().positive(),
  transferTime: z.string().optional().nullable(),
});

export const createSaleSchema = z.object({
  saleNumber: z.string().min(1).max(50),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().positive(),
  paymentStatus: z.string().optional().default('paid'),
  notes: z.string().max(500).optional().nullable(),
  createdAt: z.string().datetime().optional(),
});

export type CreateSaleDto = z.infer<typeof createSaleSchema>;
export type SaleItemDto = z.infer<typeof saleItemSchema>;
export type SalePaymentDto = z.infer<typeof salePaymentSchema>;

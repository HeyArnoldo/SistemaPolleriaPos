import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  imageUrl: z.string().max(500).optional().nullable(),
  categoryId: z.number().int().positive(),
  isActive: z.boolean().optional().default(true),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  imageUrl: z.string().max(500).nullable().optional(),
  categoryId: z.number().int().positive(),
  isActive: z.boolean().optional(),
  // Points earned per unit when sold with customer_dni (D3). Default 0.
  puntaje: z.number().int().min(0).optional().default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  // TypeORM can return puntaje as number or coercible string.
  puntaje: z.coerce.number().int().min(0).optional().default(0),
  category: categorySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

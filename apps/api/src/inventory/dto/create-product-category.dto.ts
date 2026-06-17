import { z } from 'zod';

export const createProductCategorySchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateProductCategoryDto = z.infer<typeof createProductCategorySchema>;

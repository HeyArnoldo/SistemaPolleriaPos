import { z } from 'zod';

export const biPeriodSchema = z.enum(['today', 'week', 'month', 'year']);
export type BIPeriod = z.infer<typeof biPeriodSchema>;

export const biGroupBySchema = z.enum(['day', 'week', 'month']);
export type BIGroupBy = z.infer<typeof biGroupBySchema>;

export const biQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: biPeriodSchema.optional(),
  groupBy: biGroupBySchema.optional(),
  paymentMethodIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      const arr = Array.isArray(val) ? val : [val];
      return arr.map(Number).filter((n) => !isNaN(n) && n > 0);
    })
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type BIQuery = z.infer<typeof biQuerySchema>;

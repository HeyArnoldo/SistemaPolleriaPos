import { z } from 'zod';

// Reward catalog entry — lives in apps/api (local per sede), not in the hub (D2).
export const rewardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  // Cost in points; must be a positive integer.
  costPoints: z.number().int().positive(),
  isActive: z.boolean(),
  createdAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString()))
    .optional(),
});
export type Reward = z.infer<typeof rewardSchema>;

// Input schema for creating a reward.
export const createRewardSchema = z.object({
  name: z.string().min(1),
  costPoints: z.number().int().positive(),
  isActive: z.boolean().default(true),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

// Input schema for updating a reward.
export const updateRewardSchema = createRewardSchema.partial();
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

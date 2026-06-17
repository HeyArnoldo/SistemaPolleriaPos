import { z } from 'zod';

export const updateSettingsSchema = z.object({
  storeName: z.string().min(1).max(255),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const storeSettingSchema = z.object({
  id: z.number().int(),
  storeName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StoreSetting = z.infer<typeof storeSettingSchema>;

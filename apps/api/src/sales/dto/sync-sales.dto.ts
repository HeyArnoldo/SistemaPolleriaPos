import { z } from 'zod';
import { createSaleSchema } from './create-sale.dto';

export const syncSalesSchema = z.array(createSaleSchema).min(1).max(50);

export type SyncSalesDto = z.infer<typeof syncSalesSchema>;

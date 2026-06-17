export { createSaleSchema, syncSalesSchema, cancelSaleSchema } from '@app/contracts';

export type {
  CreateSaleInput as CreateSaleDto,
  SyncSalesInput as SyncSalesDto,
  CancelSaleInput as CancelSaleDto,
  CreateSaleItemInput as SaleItemDto,
  CreatePaymentInput as SalePaymentDto,
} from '@app/contracts';

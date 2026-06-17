import { SaleRow } from './sale-row';
import { formatCurrency } from '@/lib/formatting';
import { formatDateLabel, getDayTotals } from '@/lib/caja';
import type { Sale } from '@/types/models';

interface DayGroupProps {
  dateStr: string;
  sales: Sale[];
  onCancelSale?: (sale: Sale) => void;
  canCancel?: boolean;
}

export function DayGroup({ dateStr, sales, onCancelSale, canCancel }: DayGroupProps) {
  const { count, total, cancelledCount } = getDayTotals(sales);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">{formatDateLabel(dateStr)}</h3>
          <p className="text-xs text-muted-foreground">
            {count} venta{count !== 1 ? 's' : ''}
            {cancelledCount > 0 && ` (${cancelledCount} anulada${cancelledCount !== 1 ? 's' : ''})`}
          </p>
        </div>
        <span className="text-sm font-bold">{formatCurrency(total)}</span>
      </div>
      <div className="space-y-2">
        {sales.map((sale) => (
          <SaleRow key={sale.id} sale={sale} onCancel={onCancelSale} canCancel={canCancel} />
        ))}
      </div>
    </div>
  );
}

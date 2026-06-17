import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/formatting';
import { formatTime } from '@/lib/formatting';
import {
  getSaleTotal,
  getSalePaymentLabel,
  saleIsCancelled,
  getTransferTimeSummary,
} from '@/lib/caja';
import type { Sale } from '@/types/models';

interface SaleRowProps {
  sale: Sale;
  onCancel?: (sale: Sale) => void;
  canCancel?: boolean;
}

export function SaleRow({ sale, onCancel, canCancel }: SaleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const cancelled = saleIsCancelled(sale);
  const total = getSaleTotal(sale);
  const paymentLabel = getSalePaymentLabel(sale);
  const transferTime = getTransferTimeSummary(sale);

  return (
    <div className={`border rounded-md p-3 ${cancelled ? 'opacity-60 bg-muted/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {sale.saleNumber && (
              <span className="text-xs font-mono text-muted-foreground">{sale.saleNumber}</span>
            )}
            <span className="text-xs text-muted-foreground">{formatTime(sale.createdAt)}</span>
            {cancelled && (
              <Badge variant="destructive" className="text-xs">
                Anulado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{paymentLabel}</p>
          {transferTime && (
            <p className="text-xs text-muted-foreground">Transferencia: {transferTime}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold">{formatCurrency(total)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {canCancel && !cancelled && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={() => onCancel(sale)}
            >
              Anular
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-1">
          {sale.items?.map((item) => (
            <div
              key={item.productId}
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>
                {item.product?.name ?? `Producto #${item.productId}`} x{item.quantity}
              </span>
              <span>
                {formatCurrency(
                  (typeof item.unitPrice === 'number'
                    ? item.unitPrice
                    : parseFloat(String(item.unitPrice)) || 0) * item.quantity,
                )}
              </span>
            </div>
          ))}
          {sale.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">Nota: {sale.notes}</p>
          )}
          {cancelled && sale.cancelReason && (
            <p className="text-xs text-destructive mt-1">Motivo: {sale.cancelReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

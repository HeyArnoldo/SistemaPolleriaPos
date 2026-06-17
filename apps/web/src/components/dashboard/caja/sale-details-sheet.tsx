import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatting';
import { getSaleStatus, getPaymentDisplayName } from '@/lib/caja';
import type { Sale } from '@/types/models';

interface SaleDetailsSheetProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailsSheet({ sale, open, onOpenChange }: SaleDetailsSheetProps) {
  if (!sale) return null;

  const status = getSaleStatus(sale);
  const isCancelled = status === 'cancelled';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>
            Detalle de Venta {sale.saleNumber ? `#${sale.saleNumber}` : `#${sale.id}`}
          </SheetTitle>
          <SheetDescription>
            {formatDate(sale.createdAt)} — {formatTime(sale.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={isCancelled ? 'destructive' : 'default'}>
              {isCancelled ? 'Anulada' : 'Activa'}
            </Badge>
            {sale.cancelReason && (
              <span className="text-sm text-muted-foreground">— {sale.cancelReason}</span>
            )}
          </div>

          {/* Notes */}
          {sale.notes && (
            <div>
              <p className="text-sm font-medium mb-1">Notas</p>
              <p className="text-sm text-muted-foreground">{sale.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-sm font-semibold mb-2">Productos</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">P. Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item, idx) => (
                  <TableRow key={item.id ?? idx}>
                    <TableCell>{item.product?.name ?? `Producto #${item.productId}`}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        Number(item.subtotal ?? Number(item.unitPrice) * item.quantity),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-end font-semibold text-sm">
            <span className="mr-4 text-muted-foreground">Total</span>
            <span>{formatCurrency(Number(sale.totalAmount ?? 0))}</span>
          </div>

          {/* Payments */}
          {sale.payments.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Pagos</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metodo</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Comision</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Hora transf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.payments.map((payment, idx) => (
                    <TableRow key={payment.id ?? idx}>
                      <TableCell>{getPaymentDisplayName(payment)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(payment.grossAmount ?? payment.amount))}
                      </TableCell>
                      <TableCell className="text-right text-rose-500">
                        {formatCurrency(Number(payment.commissionAmount ?? 0))}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatCurrency(
                          Number(payment.netAmount ?? payment.grossAmount ?? payment.amount),
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.transferTime ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

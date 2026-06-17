import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatting';
import { getSaleStatus, getPaymentDisplayName, getSaleTotal, parseAmount } from '@/lib/caja';
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
  const total = getSaleTotal(sale);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{sale.saleNumber ? `#${sale.saleNumber}` : `Venta #${sale.id}`}</SheetTitle>
          <SheetDescription>
            {formatDate(sale.createdAt)} — Registrada a las {formatTime(sale.createdAt)}
            {isCancelled && sale.canceledAt
              ? ` - Anulada a las ${formatTime(sale.canceledAt)}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-2 px-4 mb-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isCancelled ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isCancelled ? 'Anulada' : 'Activa'}
          </span>
          {sale.cancelReason ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
              Motivo: {sale.cancelReason}
            </span>
          ) : null}
        </div>

        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <Card className="border-slate-200/70">
            <CardContent className="space-y-2 pt-4">
              <CardTitle className="text-sm font-medium text-slate-700">Resumen</CardTitle>
              {sale.notes?.trim() ? (
                <div className="text-sm text-slate-600">Nota: {sale.notes.trim()}</div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Total</span>
                <span className="text-base font-bold text-slate-900">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Productos</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead className="text-right">P. Unit</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sale.items ?? []).map((item, idx) => (
                    <TableRow key={item.id ?? idx}>
                      <TableCell className="font-medium">
                        {item.product?.name ?? `Prod. #${item.productId}`}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(parseAmount(item.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          item.subtotal !== undefined && item.subtotal !== null
                            ? parseAmount(item.subtotal)
                            : parseAmount(item.unitPrice) * Number(item.quantity),
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Pagos</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Hora transferencia</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sale.payments ?? []).map((payment, idx) => (
                    <TableRow key={payment.id ?? idx}>
                      <TableCell>{getPaymentDisplayName(payment)}</TableCell>
                      <TableCell>{payment.transferTime ?? '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(
                          parseAmount(payment.netAmount ?? payment.grossAmount ?? payment.amount),
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="font-semibold text-slate-600">Total</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

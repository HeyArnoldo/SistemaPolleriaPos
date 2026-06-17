import { useState } from 'react';
import { Eye, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatTime } from '@/lib/formatting';
import { groupSalesByDate, formatDateLabel, getDayTotals, getSaleStatus } from '@/lib/caja';
import { SaleDetailsSheet } from './sale-details-sheet';
import { CancelSaleDialog } from './cancel-sale-dialog';
import type { Sale } from '@/types/models';

interface CajaSalesSectionProps {
  sales: Sale[];
  isAdmin: boolean;
  onCancelSale: (saleId: number, reason: string) => void;
  isCancelling: boolean;
}

export function CajaSalesSection({
  sales,
  isAdmin,
  onCancelSale,
  isCancelling,
}: CajaSalesSectionProps) {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);

  const grouped = groupSalesByDate(sales);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setSheetOpen(true);
  };

  const handleCancelClick = (sale: Sale) => {
    setSaleToCancel(sale);
  };

  const handleConfirmCancel = (saleId: number, reason: string) => {
    onCancelSale(saleId, reason);
    setSaleToCancel(null);
  };

  if (sales.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ventas del Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay ventas registradas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ventas del Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {dates.map((date) => {
            const dateSales = grouped[date];
            const totals = getDayTotals(dateSales);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{formatDateLabel(date)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{totals.count} ventas</span>
                    {totals.cancelledCount > 0 && (
                      <span className="text-rose-500">({totals.cancelledCount} anuladas)</span>
                    )}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(totals.total)}
                    </span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateSales.map((sale) => {
                      const status = getSaleStatus(sale);
                      const cancelled = status === 'cancelled';
                      return (
                        <TableRow key={sale.id} className={cancelled ? 'opacity-60' : ''}>
                          <TableCell className="text-sm">{formatTime(sale.createdAt)}</TableCell>
                          <TableCell className="text-sm font-mono">
                            {sale.saleNumber ? `#${sale.saleNumber}` : `#${sale.id}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {sale.payments.map((p) => p.paymentMethod?.name ?? '—').join(', ')}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(Number(sale.totalAmount ?? 0))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={cancelled ? 'destructive' : 'default'}
                              className="text-xs"
                            >
                              {cancelled ? 'Anulada' : 'Activa'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewSale(sale)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isAdmin && !cancelled && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-500 hover:text-rose-600"
                                  onClick={() => handleCancelClick(sale)}
                                  title="Anular venta"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <SaleDetailsSheet sale={selectedSale} open={sheetOpen} onOpenChange={setSheetOpen} />

      <CancelSaleDialog
        sale={saleToCancel}
        open={!!saleToCancel}
        onOpenChange={(v) => {
          if (!v) setSaleToCancel(null);
        }}
        onConfirm={handleConfirmCancel}
        isLoading={isCancelling}
      />
    </>
  );
}

import { useState } from 'react';
import { Ban, CalendarDays, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatTime } from '@/lib/formatting';
import {
  groupSalesByDate,
  formatDateLabel,
  getDayTotals,
  getSaleStatus,
  getSalePaymentLabel,
  getSaleTotal,
  getTransferTimeSummary,
} from '@/lib/caja';
import { SaleDetailsSheet } from './sale-details-sheet';
import { CancelSaleDialog } from './cancel-sale-dialog';
import type { Sale } from '@/types/models';

interface CajaSalesSectionProps {
  sales: Sale[];
  isAdmin: boolean;
  onCancelSale: (saleId: number, reason: string) => void;
  isCancelling: boolean;
}

function SalesTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Hora</TableHead>
        <TableHead>Ticket</TableHead>
        <TableHead>Metodo</TableHead>
        <TableHead>Total</TableHead>
        <TableHead>Estado</TableHead>
        <TableHead className="text-right">Acciones</TableHead>
      </TableRow>
    </TableHeader>
  );
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
  const dates = Object.keys(grouped);

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

  return (
    <>
      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ventas</CardTitle>
            <CardDescription>Revisa o anula ventas desde caja</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="rounded-md border">
              <Table>
                <SalesTableHeader />
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay ventas registradas.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map((date) => {
                const dateSales = grouped[date];
                const { count, total, cancelledCount } = getDayTotals(dateSales);
                return (
                  <div key={date} className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-900">{formatDateLabel(date)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-600">
                          {count} {count === 1 ? 'venta' : 'ventas'}
                          {cancelledCount > 0 && (
                            <span className="ml-1 text-red-600">
                              ({cancelledCount} anulada{cancelledCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-slate-900">
                          Total: {formatCurrency(total)}
                        </span>
                      </div>
                    </div>
                    <Table>
                      <SalesTableHeader />
                      <TableBody>
                        {dateSales.map((sale) => {
                          const status = getSaleStatus(sale);
                          const cancelled = status === 'cancelled';
                          const badgeTone = cancelled
                            ? 'bg-red-50 text-red-700'
                            : 'bg-emerald-50 text-emerald-700';
                          const methodName = getSalePaymentLabel(sale);
                          const transferTimeSummary = getTransferTimeSummary(sale);
                          const saleTotal = getSaleTotal(sale);
                          return (
                            <TableRow key={sale.id} className={cancelled ? 'bg-red-50/50' : ''}>
                              <TableCell>{formatTime(sale.createdAt)}</TableCell>
                              <TableCell className="font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span>
                                    {sale.saleNumber ? `#${sale.saleNumber}` : `Venta #${sale.id}`}
                                  </span>
                                  {cancelled ? (
                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                      Anulada
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div>{methodName}</div>
                                  {transferTimeSummary ? (
                                    <div className="text-xs text-slate-500">
                                      Hora transf.: {transferTimeSummary}
                                    </div>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {formatCurrency(saleTotal)}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTone}`}
                                >
                                  {cancelled ? 'Anulada' : 'Activa'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewSale(sale)}
                                  >
                                    <ReceiptText className="mr-2 h-4 w-4" />
                                    Ver
                                  </Button>
                                  {isAdmin && !cancelled && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600"
                                      onClick={() => handleCancelClick(sale)}
                                      disabled={isCancelling}
                                    >
                                      <Ban className="mr-2 h-4 w-4" />
                                      Anular
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
            </div>
          )}
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

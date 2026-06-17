import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetSales, useCancelSale } from '@/hooks/use-sales';
import { DayGroup } from '@/components/dashboard/caja/day-group';
import { CancelSaleDialog } from '@/components/dashboard/caja/cancel-sale-dialog';
import { CashReportCard } from '@/components/dashboard/caja/cash-report-card';
import { groupSalesByDate } from '@/lib/caja';
import { getErrorMessage } from '@/lib/errors';
import type { Sale } from '@/types/models';

export default function CajaPage() {
  const { data: sales = [], isLoading } = useGetSales();
  const { mutate: cancelSale, isPending: isCancelling } = useCancelSale();

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);

  const grouped = groupSalesByDate(sales);

  const handleCancelConfirm = (saleId: number, reason: string) => {
    cancelSale(
      { id: saleId, payload: { reason } },
      {
        onSuccess: () => {
          toast.success('Venta anulada');
          setSaleToCancel(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al anular la venta'));
        },
      },
    );
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Caja</h1>

      <Tabs defaultValue="historial">
        <TabsList>
          <TabsTrigger value="historial">Historial de ventas</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No hay ventas registradas
            </p>
          ) : (
            <div>
              {Object.entries(grouped).map(([dateStr, daySales]) => (
                <DayGroup
                  key={dateStr}
                  dateStr={dateStr}
                  sales={daySales}
                  onCancelSale={setSaleToCancel}
                  canCancel={true}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reportes" className="mt-4">
          <div className="max-w-md">
            <CashReportCard />
          </div>
        </TabsContent>
      </Tabs>

      <CancelSaleDialog
        sale={saleToCancel}
        open={!!saleToCancel}
        onOpenChange={(v) => !v && setSaleToCancel(null)}
        onConfirm={handleCancelConfirm}
        isLoading={isCancelling}
      />
    </div>
  );
}

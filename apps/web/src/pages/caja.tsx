import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useGetSales, useCancelSale } from '@/hooks/use-sales';
import { useMe } from '@/hooks/use-auth';
import { canAccessRoute } from '@/lib/permissions';
import { DayGroup } from '@/components/dashboard/caja/day-group';
import { CancelSaleDialog } from '@/components/dashboard/caja/cancel-sale-dialog';
import { CashReportCard } from '@/components/dashboard/caja/cash-report-card';
import { groupSalesByDate } from '@/lib/caja';
import { getErrorMessage } from '@/lib/errors';
import type { Sale } from '@/types/models';

export default function CajaPage() {
  const { data: sales = [], isLoading, isError } = useGetSales();
  const { mutate: cancelSale, isPending: isCancelling } = useCancelSale();
  const { data: user } = useMe();
  const canCancel = canAccessRoute(user?.role, 'caja');

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [filterDate, setFilterDate] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
  );
  const [showAll, setShowAll] = useState(false);

  const filteredSales = showAll
    ? sales
    : sales.filter((s) => {
        const d = new Date(s.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        return d === filterDate;
      });

  const grouped = groupSalesByDate(filteredSales);

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
          <div className="flex items-center gap-2 mb-4">
            <Input
              type="date"
              value={showAll ? '' : filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setShowAll(false);
              }}
              className="w-36 text-sm"
              disabled={showAll}
            />
            <Button
              variant={showAll ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Filtrar por día' : 'Ver todo'}
            </Button>
          </div>

          {isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Error al cargar las ventas. Intenta nuevamente.</AlertDescription>
            </Alert>
          )}

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
                  canCancel={canCancel}
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

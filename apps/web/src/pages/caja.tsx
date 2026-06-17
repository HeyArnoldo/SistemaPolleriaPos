import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGetCashDashboard, useGetExpenses, useDeleteExpense } from '@/hooks/use-cash';
import { useGetSales, useCancelSale } from '@/hooks/use-sales';
import { useMe } from '@/hooks/use-auth';
import { canAccessRoute } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/errors';
import { CajaHeader } from '@/components/dashboard/caja/caja-header';
import { CajaSummaryCards } from '@/components/dashboard/caja/caja-summary-cards';
import { CajaMethodsTable } from '@/components/dashboard/caja/caja-methods-table';
import { CajaSalesSection } from '@/components/dashboard/caja/caja-sales-section';
import { CajaExpensesSection } from '@/components/dashboard/caja/caja-expenses-section';
import { CashReportCard } from '@/components/dashboard/caja/cash-report-card';

function getTodayLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function getDayRange(date: string): { from: string; to: string } {
  return {
    from: `${date}T00:00:00`,
    to: `${date}T23:59:59`,
  };
}

export default function CajaPage() {
  const [filterDate, setFilterDate] = useState<string>(getTodayLima());
  const [showAll, setShowAll] = useState(false);

  const { data: user } = useMe();
  const isAdmin = canAccessRoute(user?.role, 'caja');

  // Dashboard summary — always uses filterDate (per-day)
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
    isFetching: dashboardFetching,
    refetch: dashboardRefetch,
    dataUpdatedAt,
  } = useGetCashDashboard(filterDate);

  // Sales — date-filtered when showAll is false
  const { from, to } = getDayRange(filterDate);
  const salesFilter = showAll ? { limit: 500 } : { from, to, limit: 500 };

  const {
    data: sales = [],
    isLoading: salesLoading,
    isError: salesError,
  } = useGetSales(salesFilter);

  // Expenses — always filtered to the selected day
  const {
    data: expenses = [],
    isLoading: expensesLoading,
    isError: expensesError,
  } = useGetExpenses({ startDate: from, endDate: to });

  const { mutate: cancelSale, isPending: isCancelling } = useCancelSale();
  const { mutate: deleteExpense, isPending: isDeletingExpense } = useDeleteExpense();

  const handleCancelSale = (saleId: number, reason: string) => {
    cancelSale(
      { id: saleId, payload: { reason } },
      {
        onSuccess: () => {
          toast.success('Venta anulada');
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al anular la venta'));
        },
      },
    );
  };

  const handleDeleteExpense = (id: number) => {
    deleteExpense(id, {
      onSuccess: () => {
        toast.success('Egreso eliminado');
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al eliminar el egreso'));
      },
    });
  };

  const handleRefresh = () => {
    void dashboardRefetch();
  };

  const isLoading = dashboardLoading || salesLoading || expensesLoading;

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <CajaHeader
        dataUpdatedAt={dataUpdatedAt}
        isFetching={dashboardFetching}
        onRefresh={handleRefresh}
        isAdmin={isAdmin}
      />

      <Tabs defaultValue="historial">
        <TabsList>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="filterDate" className="text-sm">
                Fecha
              </Label>
              <Input
                id="filterDate"
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setShowAll(false);
                }}
                className="w-40 text-sm"
                disabled={showAll}
              />
            </div>
            <Button
              variant={showAll ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Filtrar por dia' : 'Ver todo'}
            </Button>
            {showAll && (
              <p className="text-xs text-muted-foreground">
                Mostrando todas las ventas. El resumen del dia refleja la fecha seleccionada.
              </p>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {/* Errors */}
          {(dashboardError || salesError || expensesError) && !isLoading && (
            <Alert variant="destructive">
              <AlertDescription>
                Error al cargar los datos de caja. Intente nuevamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard summary — always per filterDate */}
          {!dashboardLoading && dashboard && (
            <>
              <CajaSummaryCards totals={dashboard.totals} />
              <CajaMethodsTable summary={dashboard.summary} />
            </>
          )}

          {/* Sales section */}
          {!salesLoading && (
            <CajaSalesSection
              sales={sales}
              isAdmin={isAdmin}
              onCancelSale={handleCancelSale}
              isCancelling={isCancelling}
            />
          )}

          {/* Expenses section — admin only */}
          {isAdmin && !expensesLoading && (
            <CajaExpensesSection
              expenses={expenses}
              onDeleteExpense={handleDeleteExpense}
              isDeleting={isDeletingExpense}
            />
          )}
        </TabsContent>

        <TabsContent value="reportes" className="mt-4">
          <div className="max-w-md">
            <CashReportCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

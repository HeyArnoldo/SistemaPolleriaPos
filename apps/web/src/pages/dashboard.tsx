import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import { useGetCashDashboard } from '@/hooks/use-cash';
import { formatCurrency } from '@/lib/formatting';

function formatTime(iso: string | undefined | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  });
}

export default function DashboardPage() {
  const [date, setDate] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
  );

  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } =
    useGetCashDashboard(date);

  const methods = data?.summary ?? [];
  const totals = data?.totals;
  const transactions = data?.transactions ?? [];
  const hasTransactions = transactions.length > 0;
  const hasMethods = methods.length > 0;

  const salesNetTotal = Number(totals?.salesNet ?? 0);
  const expensesTotal = Number(totals?.expensesTotal ?? 0);
  const netTotal = Number(totals?.netTotal ?? salesNetTotal - expensesTotal);

  const NetIcon = netTotal >= 0 ? ArrowUpRight : ArrowDownRight;
  const netTone = netTotal >= 0 ? 'text-emerald-600' : 'text-rose-600';

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Lima',
      })
    : 'Sin actualizar';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resumen de caja
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dia actual</h1>
          <p className="text-sm text-slate-500">
            Actualizado {updatedLabel}
            {isFetching ? ' (actualizando...)' : ''}
          </p>
          <p className="text-xs text-slate-500">
            Los datos se refrescan automaticamente cada 15 segundos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error al cargar el resumen. Intenta nuevamente.</AlertDescription>
        </Alert>
      )}

      {/* Loading spinner */}
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando resumen de caja...
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Ventas (Neto)</CardTitle>
            <CardDescription>Monto real recibido</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(salesNetTotal)}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Neto del dia</CardTitle>
            <CardDescription>Ventas netas - egresos</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <p className={`text-3xl font-bold ${netTone}`}>{formatCurrency(netTotal)}</p>
            <NetIcon className={`h-5 w-5 ${netTone}`} />
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Egresos</CardTitle>
            <CardDescription>Gastos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(expensesTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por metodo */}
      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Desglose por metodo</CardTitle>
            <CardDescription>Ventas netas y egresos por metodo</CardDescription>
          </div>
          {isFetching ? <span className="text-xs text-slate-500">Actualizando...</span> : null}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead>Egresos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasMethods && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-sm text-slate-500">
                      Aun no hay datos de caja para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  methods.map((method) => {
                    const net = Number(method.netTotal ?? 0);
                    const tone = net >= 0 ? 'text-emerald-600' : 'text-rose-600';
                    return (
                      <TableRow key={method.paymentMethodId}>
                        <TableCell className="font-medium text-slate-900">
                          {method.paymentMethodName ?? `Metodo #${method.paymentMethodId}`}
                        </TableCell>
                        <TableCell>{formatCurrency(method.salesNet)}</TableCell>
                        <TableCell>{formatCurrency(method.expensesTotal)}</TableCell>
                        <TableCell className={`text-right font-semibold ${tone}`}>
                          {formatCurrency(net)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transacciones del dia */}
      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transacciones del dia</CardTitle>
            <CardDescription>Ventas y egresos con montos netos</CardDescription>
          </div>
          {isFetching ? <span className="text-xs text-slate-500">Actualizando...</span> : null}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasTransactions && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-sm text-slate-500">
                      Aun no hay transacciones para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx, index) => {
                    const isSale = tx.type === 'sale';
                    const tone = isSale ? 'text-emerald-700' : 'text-amber-700';
                    const badge = isSale
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700';
                    const concept = isSale
                      ? tx.saleNumber
                        ? `Venta ${tx.saleNumber}`
                        : (tx.concept ?? '-')
                      : (tx.description ?? tx.concept ?? '-');

                    return (
                      <TableRow key={`${tx.type}-${index}`}>
                        <TableCell className="text-xs text-slate-500">
                          {formatTime(tx.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
                          >
                            {isSale ? 'Venta' : 'Egreso'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {tx.paymentMethodName}
                        </TableCell>
                        <TableCell className="text-slate-700">{concept}</TableCell>
                        <TableCell className="text-slate-900">
                          {formatCurrency(isSale ? tx.netAmount : tx.amount)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${tone}`}>
                          {formatCurrency(isSale ? tx.grossAmount : tx.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

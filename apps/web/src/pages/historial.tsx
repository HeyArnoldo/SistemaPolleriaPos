import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useGetBICommissions,
  useGetBIDetail,
  useGetBISummary,
  useGetBITrends,
} from '@/hooks/use-bi';
import { useGetPaymentMethods } from '@/hooks/use-payment-methods';
import { formatCurrency, formatDateTime } from '@/lib/formatting';
import type { BIDetailTransaction, BIGroupBy, BIPeriod, BIQueryParams } from '@/types/models';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function toIsoStart(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T00:00:00`).toISOString();
}

function toIsoEnd(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T23:59:59`).toISOString();
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

function TransactionDetailTable({ rows }: { rows: BIDetailTransaction[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead>Metodo</TableHead>
            <TableHead>Bruto</TableHead>
            <TableHead>Neto</TableHead>
            <TableHead>Comision</TableHead>
            <TableHead>%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-20 text-center text-sm text-slate-500">
                Sin registros para el filtro actual.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDateTime(row.date)}</TableCell>
                <TableCell>{row.saleNumber}</TableCell>
                <TableCell>{row.paymentMethodName}</TableCell>
                <TableCell>{formatCurrency(row.grossAmount)}</TableCell>
                <TableCell>{formatCurrency(row.netAmount)}</TableCell>
                <TableCell>{formatCurrency(row.commissionAmount)}</TableCell>
                <TableCell>{Number(row.commissionPercentage ?? 0).toFixed(2)}%</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------

export default function HistorialPage() {
  const { data: paymentMethods = [] } = useGetPaymentMethods();

  const [period, setPeriod] = useState<BIPeriod | 'custom'>('month');
  const [groupBy, setGroupBy] = useState<BIGroupBy>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodIds, setPaymentMethodIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const queryParams: BIQueryParams = useMemo(() => {
    const params: BIQueryParams = {
      groupBy,
      page,
      limit,
      paymentMethodIds: paymentMethodIds.length > 0 ? paymentMethodIds : undefined,
    };
    if (period !== 'custom') {
      params.period = period;
    } else {
      params.startDate = toIsoStart(startDate);
      params.endDate = toIsoEnd(endDate);
    }
    return params;
  }, [endDate, groupBy, limit, page, paymentMethodIds, period, startDate]);

  const summaryQuery = useGetBISummary(queryParams);
  const detailQuery = useGetBIDetail(queryParams);
  const commissionsQuery = useGetBICommissions(queryParams);
  const trendsQuery = useGetBITrends(queryParams);

  const isLoading =
    summaryQuery.isLoading ||
    detailQuery.isLoading ||
    commissionsQuery.isLoading ||
    trendsQuery.isLoading;

  const togglePaymentMethod = (id: number, checked: boolean) => {
    setPage(1);
    setPaymentMethodIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  };

  const summary = summaryQuery.data?.summary;
  const byPaymentMethod = summaryQuery.data?.byPaymentMethod ?? [];
  const trends = trendsQuery.data ?? summaryQuery.data?.trend ?? [];
  const transactions = detailQuery.data?.transactions ?? [];
  const pagination = detailQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const commissionsByMethod = commissionsQuery.data?.byPaymentMethod ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">BI / Historial</h1>
        <p className="text-sm text-slate-500">
          Analítica de ventas, comisiones y tendencias por método de pago.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Aplica periodo, agrupación, métodos y paginación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label>Periodo</Label>
              <Select
                value={period}
                onValueChange={(value) => {
                  setPage(1);
                  setPeriod(value as BIPeriod | 'custom');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Agrupar por</Label>
              <Select
                value={groupBy}
                onValueChange={(value) => {
                  setPage(1);
                  setGroupBy(value as BIGroupBy);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setPage(1);
                  setStartDate(e.target.value);
                  setPeriod('custom');
                }}
              />
            </div>

            <div className="space-y-1">
              <Label>Fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setPage(1);
                  setEndDate(e.target.value);
                  setPeriod('custom');
                }}
              />
            </div>

            <div className="space-y-1">
              <Label>Página</Label>
              <Input
                type="number"
                min={1}
                value={page}
                onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-1">
              <Label>Límite</Label>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setPage(1);
                  setLimit(Number(value));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentMethods.length > 0 && (
            <div className="space-y-2">
              <Label>Métodos de pago</Label>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={paymentMethodIds.includes(method.id)}
                      onCheckedChange={(checked) =>
                        togglePaymentMethod(method.id, Boolean(checked))
                      }
                    />
                    <span>{method.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando BI...
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Ventas brutas" value={formatCurrency(summary?.totalSalesGross ?? 0)} />
        <KpiCard label="Ventas netas" value={formatCurrency(summary?.totalSalesNet ?? 0)} />
        <KpiCard label="Comisiones" value={formatCurrency(summary?.totalCommissions ?? 0)} />
      </div>

      {/* By payment method summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen por metodo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead>Comision</TableHead>
                  <TableHead># Transacciones</TableHead>
                  <TableHead>Ticket Prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPaymentMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-sm text-slate-500">
                      Sin datos para el filtro actual.
                    </TableCell>
                  </TableRow>
                ) : (
                  byPaymentMethod.map((row) => (
                    <TableRow key={row.paymentMethodId}>
                      <TableCell>{row.paymentMethodName}</TableCell>
                      <TableCell>{formatCurrency(row.salesGross)}</TableCell>
                      <TableCell>{formatCurrency(row.salesNet)}</TableCell>
                      <TableCell>{formatCurrency(row.commissionsTotal)}</TableCell>
                      <TableCell>{row.transactionCount}</TableCell>
                      <TableCell>{formatCurrency(row.averageTicket)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead>Comision</TableHead>
                  <TableHead># Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-sm text-slate-500">
                      Sin tendencias para el filtro actual.
                    </TableCell>
                  </TableRow>
                ) : (
                  trends.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{formatCurrency(row.salesGross)}</TableCell>
                      <TableCell>{formatCurrency(row.salesNet)}</TableCell>
                      <TableCell>{formatCurrency(row.commissionsTotal)}</TableCell>
                      <TableCell>{row.transactionCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction detail with pagination */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detalle de pagos</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-500">
              Pag {pagination?.page ?? page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(pagination?.page ?? page) >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TransactionDetailTable rows={transactions} />
        </CardContent>
      </Card>

      {/* Commissions detail */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de comisiones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Comision %</TableHead>
                  <TableHead>Total comisiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionsByMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center text-sm text-slate-500">
                      Sin comisiones para el filtro actual.
                    </TableCell>
                  </TableRow>
                ) : (
                  commissionsByMethod.map((row) => (
                    <TableRow key={row.paymentMethodId}>
                      <TableCell>{row.paymentMethodName}</TableCell>
                      <TableCell>{Number(row.commissionPercentage ?? 0).toFixed(2)}%</TableCell>
                      <TableCell>{formatCurrency(row.commissionsTotal)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

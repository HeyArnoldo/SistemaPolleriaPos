import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatting';
import type { CashDashboardSummaryRow } from '@/types/models';

interface CajaMethodsTableProps {
  summary: CashDashboardSummaryRow[];
  isFetching?: boolean;
}

export function CajaMethodsTable({ summary, isFetching }: CajaMethodsTableProps) {
  return (
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
                <TableHead>Ventas netas</TableHead>
                <TableHead>Egresos</TableHead>
                <TableHead className="text-right">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-sm text-slate-500">
                    Aun no hay datos de caja para mostrar.
                  </TableCell>
                </TableRow>
              ) : (
                summary.map((method) => {
                  const net = Number(method.netTotal ?? 0);
                  const tone = net >= 0 ? 'text-emerald-600' : 'text-rose-600';
                  return (
                    <TableRow key={method.paymentMethodId}>
                      <TableCell className="font-medium text-slate-900">
                        {method.paymentMethodName ?? `Metodo #${method.paymentMethodId}`}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(method.salesNet))}</TableCell>
                      <TableCell>{formatCurrency(Number(method.expensesTotal))}</TableCell>
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
  );
}

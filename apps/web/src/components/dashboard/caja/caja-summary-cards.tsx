import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatting';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { CashDashboardTotals, CashDashboardSummaryRow } from '@/types/models';

interface CajaSummaryCardsProps {
  totals: CashDashboardTotals;
  summary?: CashDashboardSummaryRow[];
}

function getMethodDescription(methodName: string) {
  const normalized = methodName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  if (normalized.includes('efectivo')) return 'Disponible tras egresos';
  if (normalized.includes('yape') || normalized.includes('plin')) return 'Disponible en billeteras';
  return 'Disponible en cuenta';
}

export function CajaSummaryCards({ totals, summary = [] }: CajaSummaryCardsProps) {
  const salesNet = Number(totals.salesNet);
  const expensesTotal = Number(totals.expensesTotal);
  const netTotal = Number(totals.netTotal);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Ventas netas</CardTitle>
          <CardDescription>Monto real recibido</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(salesNet)}</p>
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

      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Neto del dia</CardTitle>
          <CardDescription>Ventas netas - egresos</CardDescription>
        </CardHeader>
        <CardContent className="flex items-baseline justify-between">
          <p
            className={`text-3xl font-bold ${netTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {formatCurrency(netTotal)}
          </p>
          {netTotal >= 0 ? (
            <ArrowUpRight className="h-5 w-5 text-emerald-600" />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-rose-600" />
          )}
        </CardContent>
      </Card>

      {summary.map((method) => (
        <Card className="border-slate-200/70 shadow-sm" key={method.paymentMethodId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Saldo {method.paymentMethodName}
            </CardTitle>
            <CardDescription>{getMethodDescription(method.paymentMethodName)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(Number(method.netTotal))}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

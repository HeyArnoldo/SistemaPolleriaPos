import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatting';
import type { CashDashboardTotals } from '@/types/models';

interface CajaSummaryCardsProps {
  totals: CashDashboardTotals;
}

export function CajaSummaryCards({ totals }: CajaSummaryCardsProps) {
  const cards = [
    {
      label: 'Ventas netas',
      value: Number(totals.salesNet),
      className: 'text-emerald-600',
    },
    {
      label: 'Egresos',
      value: Number(totals.expensesTotal),
      className: 'text-rose-600',
    },
    {
      label: 'Neto del dia',
      value: Number(totals.netTotal),
      className: Number(totals.netTotal) >= 0 ? 'text-emerald-700' : 'text-rose-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-bold ${card.className}`}>{formatCurrency(card.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

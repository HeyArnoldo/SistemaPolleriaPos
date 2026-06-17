import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

export function CajaMethodsTable({ summary }: CajaMethodsTableProps) {
  if (summary.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Desglose por Metodo de Pago</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metodo</TableHead>
              <TableHead className="text-right">Ventas brutas</TableHead>
              <TableHead className="text-right">Ventas netas</TableHead>
              <TableHead className="text-right">Comisiones</TableHead>
              <TableHead className="text-right">Egresos</TableHead>
              <TableHead className="text-right">Neto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.paymentMethodId}>
                <TableCell className="font-medium">{row.paymentMethodName}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(row.salesGross))}
                </TableCell>
                <TableCell className="text-right text-emerald-600">
                  {formatCurrency(Number(row.salesNet))}
                </TableCell>
                <TableCell className="text-right text-rose-500">
                  {formatCurrency(Number(row.commissionsTotal))}
                </TableCell>
                <TableCell className="text-right text-rose-600">
                  {formatCurrency(Number(row.expensesTotal))}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(row.netTotal))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

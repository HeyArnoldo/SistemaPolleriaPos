import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { useGetCashDashboard } from '@/hooks/use-cash';
import { formatCurrency } from '@/lib/formatting';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DashboardPage() {
  const [date, setDate] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
  );

  const { data, isLoading, isError } = useGetCashDashboard(date);

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40 text-sm"
        />
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error al cargar el resumen. Intenta nuevamente.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ventas brutas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.salesGross ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  -{formatCurrency(data?.totals.expensesTotal ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total neto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.netTotal ?? 0)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : !data || data.summary.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No hay datos para esta fecha
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose por método de pago</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Ventas brutas</TableHead>
                  <TableHead className="text-right">Comisiones</TableHead>
                  <TableHead className="text-right">Ventas netas</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((row) => (
                  <TableRow key={row.paymentMethodId}>
                    <TableCell className="font-medium">{row.paymentMethodName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.salesGross)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      -{formatCurrency(row.commissionsTotal)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.salesNet)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatCurrency(row.expensesTotal)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(row.netTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

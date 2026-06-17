import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { formatCurrency, formatTime } from '@/lib/formatting';
import {
  groupExpensesByDate,
  formatDateLabel,
  getDayExpensesTotal,
  getExpensePaymentName,
} from '@/lib/caja';
import type { Expense } from '@/types/models';

interface CajaExpensesSectionProps {
  expenses: Expense[];
  onDeleteExpense: (id: number) => void;
  isDeleting: boolean;
}

export function CajaExpensesSection({
  expenses,
  onDeleteExpense,
  isDeleting,
}: CajaExpensesSectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const grouped = groupExpensesByDate(expenses);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Egresos del Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay egresos registrados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Egresos del Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {dates.map((date) => {
            const dateExpenses = grouped[date];
            const total = getDayExpensesTotal(dateExpenses);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{formatDateLabel(date)}</p>
                  <span className="text-xs font-semibold text-rose-600">
                    {formatCurrency(total)}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-sm">{expense.description}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-rose-600">
                          {formatCurrency(Number(expense.amount))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {expense.receiptNumber ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">{getExpensePaymentName(expense)}</TableCell>
                        <TableCell className="text-sm">{formatTime(expense.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600"
                            onClick={() => handleDeleteClick(expense)}
                            title="Eliminar egreso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar egreso"
        description={`Confirmas la eliminacion del egreso "${expenseToDelete?.description}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </>
  );
}

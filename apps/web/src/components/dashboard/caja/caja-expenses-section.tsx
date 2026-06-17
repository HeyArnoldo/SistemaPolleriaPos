import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <>
      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Egresos</CardTitle>
            <CardDescription>Solo administrador puede anular egresos desde aqui</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay egresos registrados.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map((date) => {
                const dateExpenses = grouped[date];
                const total = getDayExpensesTotal(dateExpenses);
                return (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {formatDateLabel(date)}
                      </h3>
                      <span className="text-sm font-medium text-red-600">
                        Total: {formatCurrency(total)}
                      </span>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripcion</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Metodo</TableHead>
                            <TableHead>Hora</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dateExpenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell className="font-medium text-slate-900">
                                {expense.description}
                              </TableCell>
                              <TableCell className="font-semibold text-red-600">
                                {formatCurrency(Number(expense.amount ?? 0))}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {expense.receiptNumber ?? '-'}
                              </TableCell>
                              <TableCell>{getExpensePaymentName(expense)}</TableCell>
                              <TableCell>{formatTime(expense.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => handleDeleteClick(expense)}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Anular
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Anular egreso"
        description={`Confirmas la anulacion del egreso "${expenseToDelete?.description}"? Esta accion no se puede deshacer.`}
        confirmLabel="Anular"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Plus } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useGetExpenses, useCreateExpense, useDeleteExpense } from '@/hooks/use-cash';
import { useGetPaymentMethods } from '@/hooks/use-payment-methods';
import { useConnectivity } from '@/hooks/use-connectivity';
import { formatCurrency, formatDateTime } from '@/lib/formatting';
import {
  groupExpensesByDate,
  formatDateLabel,
  getDayExpensesTotal,
  getExpensePaymentName,
} from '@/lib/caja';
import { getErrorMessage } from '@/lib/errors';
import { enqueueExpense } from '@/lib/queue-manager';
import type { Expense } from '@/types/models';

interface ExpenseFormValues {
  description: string;
  amount: string;
  paymentMethodId: string;
  receiptNumber?: string;
}

export default function EgresosPage() {
  const { data: expenses = [], isLoading } = useGetExpenses();
  const { data: paymentMethods = [] } = useGetPaymentMethods();
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense();
  const { mutate: deleteExpense, isPending: isDeleting } = useDeleteExpense();
  const { isOnline } = useConnectivity();

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>();

  const paymentMethodId = watch('paymentMethodId');

  const onSubmit = async (values: ExpenseFormValues) => {
    const payload = {
      description: values.description.trim(),
      amount: parseFloat(values.amount),
      paymentMethodId: parseInt(values.paymentMethodId),
      ...(values.receiptNumber?.trim() ? { receiptNumber: values.receiptNumber.trim() } : {}),
    };

    if (!isOnline) {
      await enqueueExpense(crypto.randomUUID(), payload);
      toast.success('Egreso guardado sin conexión — se enviará al reconectarse');
      reset();
      setShowForm(false);
      return;
    }

    createExpense(payload, {
      onSuccess: () => {
        toast.success('Egreso registrado');
        reset();
        setShowForm(false);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al registrar el egreso'));
      },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteExpense(deleteId, {
      onSuccess: () => {
        toast.success('Egreso eliminado');
        setDeleteId(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al eliminar el egreso'));
      },
    });
  };

  const grouped = groupExpensesByDate(expenses);

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Egresos</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo egreso
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar egreso</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="description">Descripcion</Label>
                <Input
                  id="description"
                  {...register('description', { required: 'La descripcion es requerida' })}
                  placeholder="Descripcion del egreso..."
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('amount', { required: 'El monto es requerido' })}
                    placeholder="0.00"
                  />
                  {errors.amount && (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Metodo de pago</Label>
                  <Select
                    value={paymentMethodId}
                    onValueChange={(v) => setValue('paymentMethodId', v, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="receiptNumber">N. Comprobante (opcional)</Label>
                <Input id="receiptNumber" {...register('receiptNumber')} placeholder="0001" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Guardando...' : 'Registrar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setShowForm(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No hay egresos registrados</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, dayExpenses]) => (
            <div key={dateStr}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">{formatDateLabel(dateStr)}</h3>
                <span className="text-sm font-bold text-destructive">
                  -{formatCurrency(getDayExpensesTotal(dayExpenses))}
                </span>
              </div>
              <div className="space-y-2">
                {dayExpenses.map((expense) => (
                  <ExpenseItem
                    key={expense.id}
                    expense={expense}
                    onDelete={() => setDeleteId(expense.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Eliminar egreso"
        description="El egreso sera eliminado permanentemente."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

interface ExpenseItemProps {
  expense: Expense;
  onDelete: () => void;
}

function ExpenseItem({ expense, onDelete }: ExpenseItemProps) {
  return (
    <div className="border rounded-md p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{expense.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {getExpensePaymentName(expense)}
          {expense.receiptNumber && ` · Comp. ${expense.receiptNumber}`}
          {' · '}
          {formatDateTime(expense.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-destructive">
          -{formatCurrency(expense.amount)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

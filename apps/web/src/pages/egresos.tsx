import { useMemo, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, AlertCircle } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useGetExpenses, useCreateExpense, useDeleteExpense } from '@/hooks/use-cash';
import { useGetPaymentMethods } from '@/hooks/use-payment-methods';
import { useConnectivity } from '@/hooks/use-connectivity';
import { formatCurrency, formatTime } from '@/lib/formatting';
import {
  groupExpensesByDate,
  formatDateLabel,
  getDayExpensesTotal,
  getExpensePaymentName,
} from '@/lib/caja';
import { getErrorMessage } from '@/lib/errors';
import { enqueueExpense } from '@/lib/queue-manager';

export default function EgresosPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const [dateFilter, setDateFilter] = useState<string>(today);
  const [showAll, setShowAll] = useState(false);

  const {
    data: expenses = [],
    isLoading,
    isError,
  } = useGetExpenses(showAll ? undefined : { startDate: dateFilter, endDate: dateFilter });
  const { data: paymentMethods = [], isLoading: isLoadingPaymentMethods } = useGetPaymentMethods();
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense();
  const { mutate: deleteExpense, isPending: isDeleting } = useDeleteExpense();
  const { isOnline } = useConnectivity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const totalExpenses = useMemo(
    () => expenses.reduce((acc, item) => acc + Number(item.amount ?? 0), 0),
    [expenses],
  );

  const grouped = useMemo(() => groupExpensesByDate(expenses), [expenses]);

  const isMethodsUnavailable = paymentMethods.length === 0;
  const selectedPaymentMethodId =
    paymentMethodId || (paymentMethods[0] ? String(paymentMethods[0].id) : '');

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setReceiptNumber('');
    setPaymentMethodId('');
  };

  const handleCreate = async () => {
    const parsedAmount = Number(amount);
    if (!description.trim()) {
      toast.error('La descripcion es obligatoria.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Ingresa un monto valido.');
      return;
    }
    if (!selectedPaymentMethodId) {
      toast.error('Selecciona un metodo de pago.');
      return;
    }

    const payload = {
      description: description.trim(),
      amount: Number(parsedAmount.toFixed(2)),
      paymentMethodId: Number(selectedPaymentMethodId),
      ...(receiptNumber.trim() ? { receiptNumber: receiptNumber.trim() } : {}),
    };

    if (!isOnline) {
      await enqueueExpense(crypto.randomUUID(), payload);
      toast.success('Egreso guardado sin conexion — se enviara al reconectarse.');
      resetForm();
      setDialogOpen(false);
      return;
    }

    createExpense(payload, {
      onSuccess: () => {
        toast.success('Egreso registrado.');
        resetForm();
        setDialogOpen(false);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'No se pudo registrar el egreso.'));
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

  return (
    <div className="space-y-6">
      {/* Red total card */}
      <Card className="border-red-100 bg-red-50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm text-red-700">Total Egresos</CardTitle>
            <div className="text-3xl font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Nuevo Egreso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar egreso</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Descripcion</Label>
                  <Input
                    placeholder="Ej: Pago de luz"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Monto</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Metodo de pago</Label>
                    <Select
                      value={selectedPaymentMethodId}
                      onValueChange={setPaymentMethodId}
                      disabled={isLoadingPaymentMethods || isMethodsUnavailable}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
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
                  <Label>Comprobante (opcional)</Label>
                  <Input
                    placeholder="FAC-123"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || isLoadingPaymentMethods || isMethodsUnavailable}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={showAll ? '' : dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setShowAll(false);
          }}
          className="w-36 text-sm"
          disabled={showAll}
        />
        <Button
          variant={showAll ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Filtrar por dia' : 'Ver todo'}
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error al cargar los egresos. Intenta nuevamente.</AlertDescription>
        </Alert>
      )}

      {/* Expenses list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Egresos Registrados</CardTitle>
            <p className="text-sm text-muted-foreground">{expenses.length} registros</p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando egresos...
            </div>
          ) : Object.keys(grouped).length === 0 ? (
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
              {Object.entries(grouped).map(([dateStr, dayExpenses]) => (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {formatDateLabel(dateStr)}
                    </h3>
                    <span className="text-sm font-medium text-red-600">
                      Total: {formatCurrency(getDayExpensesTotal(dayExpenses))}
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
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell className="font-semibold text-red-600">
                              {formatCurrency(Number(expense.amount ?? 0))}
                            </TableCell>
                            <TableCell>{expense.receiptNumber ?? '-'}</TableCell>
                            <TableCell>{getExpensePaymentName(expense)}</TableCell>
                            <TableCell>{formatTime(expense.createdAt)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(expense.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

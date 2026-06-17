import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useResetSalesAll, useResetSalesByDate } from '@/hooks/use-sales';
import { getErrorMessage } from '@/lib/errors';

export function ResetFinancialCard() {
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [resetByDateOpen, setResetByDateOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');

  const { mutate: resetAll, isPending: isResettingAll } = useResetSalesAll();
  const { mutate: resetByDate, isPending: isResettingByDate } = useResetSalesByDate();

  const handleResetAll = () => {
    resetAll(undefined, {
      onSuccess: () => {
        toast.success('Todas las ventas fueron eliminadas');
        setResetAllOpen(false);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al resetear las ventas'));
      },
    });
  };

  const handleResetByDate = () => {
    if (!dateInput) return;
    resetByDate(dateInput, {
      onSuccess: () => {
        toast.success(`Ventas del ${dateInput} eliminadas`);
        setResetByDateOpen(false);
        setDateInput('');
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al resetear las ventas por fecha'));
      },
    });
  };

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Zona de peligro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estas acciones son irreversibles. Eliminar ventas borrara permanentemente los registros.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setResetByDateOpen(true)}
            >
              Eliminar por fecha
            </Button>
            <Button variant="destructive" onClick={() => setResetAllOpen(true)}>
              Eliminar todas las ventas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset all dialog */}
      <AlertDialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar TODAS las ventas</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente TODAS las ventas del sistema. Esta operacion no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAll}
              disabled={isResettingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResettingAll ? 'Eliminando...' : 'Eliminar todo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset by date dialog */}
      <AlertDialog open={resetByDateOpen} onOpenChange={setResetByDateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ventas por fecha</AlertDialogTitle>
            <AlertDialogDescription>
              Elimina permanentemente todas las ventas de una fecha especifica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Label htmlFor="reset-date">Fecha (YYYY-MM-DD)</Label>
            <Input
              id="reset-date"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingByDate}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetByDate}
              disabled={!dateInput || isResettingByDate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResettingByDate ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

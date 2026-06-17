import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Sale } from '@/types/models';

interface CancelSaleDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (saleId: number, reason: string) => void;
  isLoading?: boolean;
}

export function CancelSaleDialog({
  sale,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: CancelSaleDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!sale || !reason.trim()) return;
    onConfirm(sale.id, reason.trim());
    setReason('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setReason('');
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {sale?.saleNumber && (
            <p className="text-sm text-muted-foreground">
              Venta: <span className="font-mono font-medium">{sale.saleNumber}</span>
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="cancel-reason">Motivo de anulacion</Label>
            <Input
              id="cancel-reason"
              placeholder="Ingrese el motivo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? 'Anulando...' : 'Anular venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

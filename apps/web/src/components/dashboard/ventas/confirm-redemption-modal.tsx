/**
 * ConfirmRedemptionModal — shown before registering a sale with redemptions.
 * Requires explicit confirmation from the cashier (RF-39/RN-14).
 */
import { Gift } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Customer, Reward } from '@app/carbopuntos-contracts';

interface ConfirmRedemptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  currentBalance: number;
  pendingRewards: Reward[];
  onConfirm: () => void;
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

export function ConfirmRedemptionModal({
  open,
  onOpenChange,
  customer,
  currentBalance,
  pendingRewards,
  onConfirm,
}: ConfirmRedemptionModalProps) {
  const totalCost = pendingRewards.reduce((s, r) => s + r.costPoints, 0);
  const newBalance = currentBalance - totalCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <DialogTitle>Confirmar canje</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Esta acción descuenta los puntos del cliente
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-slate-50 p-3 space-y-2">
          {pendingRewards.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{r.name}</span>
              <span className="font-bold text-red-600">−{r.costPoints} pts</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-black text-red-600">−{totalCost} pts</span>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          Saldo de <strong>{shortName(customer.fullName)}</strong> quedará en{' '}
          <strong className="text-slate-900">{newBalance} pts</strong>
        </p>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Sí, canjear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

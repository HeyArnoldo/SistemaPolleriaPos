import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import type { PaymentMethod } from '@/types/models';
import type { PaymentEntry } from '@/hooks/use-payment-state';

interface PaymentFormProps {
  payments: PaymentEntry[];
  paymentMethods: PaymentMethod[];
  total: number;
  totalPaid: number;
  change: number;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onUpdateAmount: (index: number, amount: string) => void;
  onUpdateMethod: (index: number, methodId: number) => void;
  onUpdateTransferTime: (index: number, time: string) => void;
}

export function PaymentForm({
  payments,
  paymentMethods,
  total,
  totalPaid,
  change,
  onAddLine,
  onRemoveLine,
  onUpdateAmount,
  onUpdateMethod,
  onUpdateTransferTime,
}: PaymentFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pagos</h3>
        <Button variant="outline" size="sm" onClick={onAddLine} type="button">
          <Plus className="h-3 w-3 mr-1" />
          Agregar pago
        </Button>
      </div>

      {payments.map((payment, index) => {
        const method = paymentMethods.find((m) => m.id === payment.paymentMethodId);
        return (
          <div key={index} className="space-y-2 p-3 border rounded-md">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Metodo</Label>
                <Select
                  value={payment.paymentMethodId ? String(payment.paymentMethodId) : ''}
                  onValueChange={(v) => onUpdateMethod(index, Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
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
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Monto</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={payment.amount}
                  onChange={(e) => onUpdateAmount(index, e.target.value)}
                />
              </div>
              {payments.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mt-4 text-destructive hover:text-destructive"
                  onClick={() => onRemoveLine(index)}
                  type="button"
                >
                  <Minus className="h-3 w-3" />
                </Button>
              )}
            </div>
            {method?.requiresTransferTime && (
              <div>
                <Label className="text-xs text-muted-foreground">Hora de transferencia</Label>
                <Input
                  className="h-8 text-sm"
                  type="time"
                  value={payment.transferTime ?? ''}
                  onChange={(e) => onUpdateTransferTime(index, e.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="border-t pt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagado:</span>
          <span className="font-semibold">{formatCurrency(totalPaid)}</span>
        </div>
        {change > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Vuelto:</span>
            <span className="font-semibold">{formatCurrency(change)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

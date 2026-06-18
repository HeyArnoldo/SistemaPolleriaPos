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
import { formatCurrency } from '@/lib/ventas';
import type { PaymentMethod } from '@/types/models';
import { CreditCard, Wallet } from 'lucide-react';
import { useMemo, useRef, type KeyboardEvent } from 'react';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isCashMethodName = (name: string) => normalize(name).includes('efectivo');

type PaymentFormProps = {
  paymentMethods: PaymentMethod[];
  paymentMode: 'single' | 'mixed';
  onPaymentModeChange: (mode: 'single' | 'mixed') => void;
  isMixedEnabled: boolean;
  singleMethodId: number;
  onSingleMethodChange: (value: number) => void;
  singleCashReceived: string;
  onSingleCashReceivedChange: (value: string) => void;
  singleTransferTime: string;
  onSingleTransferTimeChange: (value: string) => void;
  mixedYapeAmount: string;
  onMixedYapeAmountChange: (value: string) => void;
  mixedCashAmount: string;
  onMixedCashAmountChange: (value: string) => void;
  mixedTransferTime: string;
  onMixedTransferTimeChange: (value: string) => void;
  paymentSummary: string;
  total: number;
  singleGrossAmount: number;
  singleNetAmount: number;
  singleCommissionAmount: number;
  mixedYapeGrossAmount: number;
  mixedYapeNetAmountValue: number;
  mixedYapeCommissionAmount: number;
  mixedCashAmountValue: number;
  mixedTotalGross: number;
  onRequestSubmit: () => void;
};

export function PaymentForm({
  paymentMethods,
  paymentMode,
  onPaymentModeChange,
  isMixedEnabled,
  singleMethodId,
  onSingleMethodChange,
  singleCashReceived,
  onSingleCashReceivedChange,
  singleTransferTime,
  onSingleTransferTimeChange,
  mixedYapeAmount,
  onMixedYapeAmountChange,
  mixedCashAmount,
  onMixedCashAmountChange,
  mixedTransferTime,
  onMixedTransferTimeChange,
  paymentSummary,
  total,
  singleGrossAmount,
  singleNetAmount,
  singleCommissionAmount,
  mixedYapeGrossAmount,
  mixedYapeNetAmountValue,
  mixedYapeCommissionAmount,
  mixedCashAmountValue,
  mixedTotalGross,
  onRequestSubmit,
}: PaymentFormProps) {
  const singleMethod =
    paymentMethods.find((method) => method.id === singleMethodId) ?? paymentMethods[0];
  const selectedSingleMethodId = singleMethod?.id ?? paymentMethods[0]?.id ?? singleMethodId;
  const isSingleCash = singleMethod ? isCashMethodName(singleMethod.name) : false;
  const singleCommissionPercentage = Number(singleMethod?.commissionPercentage ?? 0);
  const yapeCommissionPercentage = Number(
    paymentMethods.find(
      (m) => normalize(m.name).includes('yape') || normalize(m.name).includes('plin'),
    )?.commissionPercentage ?? 0,
  );
  const hasSingleCommission = singleCommissionPercentage > 0 && singleCommissionAmount > 0;
  const hasYapeCommission = yapeCommissionPercentage > 0 && mixedYapeCommissionAmount > 0;

  const singleMethodRef = useRef<HTMLButtonElement | null>(null);
  const singleCashReceivedRef = useRef<HTMLInputElement | null>(null);
  const singleTransferTimeRef = useRef<HTMLInputElement | null>(null);
  const mixedYapeAmountRef = useRef<HTMLInputElement | null>(null);
  const mixedCashAmountRef = useRef<HTMLInputElement | null>(null);
  const mixedTransferTimeRef = useRef<HTMLInputElement | null>(null);

  type FocusField =
    | 'singleMethod'
    | 'singleCashReceived'
    | 'singleTransferTime'
    | 'mixedYapeAmount'
    | 'mixedCashAmount'
    | 'mixedTransferTime'
    | 'submit';

  const focusOrder = useMemo<FocusField[]>(() => {
    if (paymentMode === 'single') {
      if (isSingleCash) {
        return ['singleMethod', 'singleCashReceived', 'submit'];
      }
      return singleMethod?.requiresTransferTime
        ? ['singleMethod', 'singleTransferTime', 'submit']
        : ['singleMethod', 'submit'];
    }

    return ['mixedYapeAmount', 'mixedCashAmount', 'mixedTransferTime', 'submit'];
  }, [isSingleCash, paymentMode, singleMethod?.requiresTransferTime]);

  const focusNextField = (current: FocusField) => {
    const index = focusOrder.indexOf(current);
    const next = focusOrder[index + 1];
    if (!next) return;

    if (next === 'submit') {
      onRequestSubmit();
      return;
    }

    const refMap: Record<Exclude<FocusField, 'submit'>, HTMLElement | null> = {
      singleMethod: singleMethodRef.current,
      singleCashReceived: singleCashReceivedRef.current,
      singleTransferTime: singleTransferTimeRef.current,
      mixedYapeAmount: mixedYapeAmountRef.current,
      mixedCashAmount: mixedCashAmountRef.current,
      mixedTransferTime: mixedTransferTimeRef.current,
    };

    refMap[next]?.focus();
  };

  const handleEnterToNext =
    (current: FocusField) => (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      focusNextField(current);
    };

  const paymentModeButtonClass = (mode: 'single' | 'mixed') =>
    `flex-1 ${paymentMode === mode ? 'bg-primary text-white' : ''}`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-900 p-3 text-white">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold uppercase">Total base</span>
          <span className="text-lg font-bold">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex gap-2 rounded-lg border p-1">
        <Button
          variant="ghost"
          size="sm"
          className={paymentModeButtonClass('single')}
          onClick={() => onPaymentModeChange('single')}
          type="button"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Forma de pago
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={paymentModeButtonClass('mixed')}
          onClick={() => onPaymentModeChange('mixed')}
          disabled={!isMixedEnabled}
          type="button"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Mixto
        </Button>
      </div>

      {!isMixedEnabled ? (
        <p className="text-xs text-amber-700">
          Pago mixto deshabilitado: se requiere Efectivo y Yape/Plin activos.
        </p>
      ) : null}

      {paymentMode === 'single' ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Metodo de pago</Label>
            <Select
              value={String(selectedSingleMethodId)}
              onValueChange={(value) => onSingleMethodChange(Number(value))}
            >
              <SelectTrigger ref={singleMethodRef} onKeyDown={handleEnterToNext('singleMethod')}>
                <SelectValue placeholder="Selecciona metodo" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods
                  .filter((method) => method.isActive)
                  .map((method) => (
                    <SelectItem key={method.id} value={String(method.id)}>
                      {method.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {isSingleCash ? (
            <div className="space-y-1">
              <Label>Monto recibido (efectivo)</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={singleCashReceived}
                ref={singleCashReceivedRef}
                onChange={(event) => onSingleCashReceivedChange(event.target.value)}
                onKeyDown={handleEnterToNext('singleCashReceived')}
              />
            </div>
          ) : (
            <div className="rounded-md border bg-white p-3 space-y-1.5 text-sm">
              {hasSingleCommission ? (
                <>
                  <div className="flex justify-between">
                    <span>Neto a recibir</span>
                    <strong>{formatCurrency(singleNetAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Comision ({singleCommissionPercentage.toFixed(2)}%)</span>
                    <strong>{formatCurrency(singleCommissionAmount)}</strong>
                  </div>
                  <div className="h-px bg-slate-100" />
                </>
              ) : null}
              <div className="flex justify-between text-[15px]">
                <span className="font-medium">Cobro al cliente</span>
                <strong className="tracking-tight">{formatCurrency(singleGrossAmount)}</strong>
              </div>
            </div>
          )}

          {!isSingleCash && singleMethod?.requiresTransferTime ? (
            <div className="space-y-1">
              <Label>Hora transferencia</Label>
              <Input
                type="time"
                step="1"
                value={singleTransferTime}
                ref={singleTransferTimeRef}
                onChange={(event) => onSingleTransferTimeChange(event.target.value)}
                onKeyDown={handleEnterToNext('singleTransferTime')}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Monto Yape/Plin</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={mixedYapeAmount}
                ref={mixedYapeAmountRef}
                onChange={(event) => onMixedYapeAmountChange(event.target.value)}
                onKeyDown={handleEnterToNext('mixedYapeAmount')}
              />
            </div>
            <div className="space-y-1">
              <Label>Monto Efectivo</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={mixedCashAmount}
                ref={mixedCashAmountRef}
                onChange={(event) => onMixedCashAmountChange(event.target.value)}
                onKeyDown={handleEnterToNext('mixedCashAmount')}
              />
            </div>
          </div>

          <div className="rounded-md border bg-white p-3 space-y-1.5 text-sm">
            {hasYapeCommission ? (
              <>
                <div className="flex justify-between">
                  <span>Yape/Plin neto</span>
                  <strong>{formatCurrency(mixedYapeNetAmountValue)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Comision Yape/Plin ({yapeCommissionPercentage.toFixed(2)}%)</span>
                  <strong>{formatCurrency(mixedYapeCommissionAmount)}</strong>
                </div>
                <div className="h-px bg-slate-100" />
              </>
            ) : null}
            <div className="flex justify-between">
              <span>Yape/Plin</span>
              <strong>{formatCurrency(mixedYapeGrossAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Efectivo</span>
              <strong>{formatCurrency(mixedCashAmountValue)}</strong>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex justify-between text-[15px]">
              <span className="font-medium">Total cobrado</span>
              <strong className="tracking-tight">{formatCurrency(mixedTotalGross)}</strong>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Hora transferencia Yape/Plin</Label>
            <Input
              type="time"
              step="1"
              value={mixedTransferTime}
              ref={mixedTransferTimeRef}
              onChange={(event) => onMixedTransferTimeChange(event.target.value)}
              onKeyDown={handleEnterToNext('mixedTransferTime')}
            />
          </div>
          <p className="text-xs text-slate-500">
            En pago mixto no hay vuelto: el neto debe cuadrar exacto.
          </p>
        </div>
      )}

      <div className="rounded-md bg-slate-50 p-3 text-sm">
        <div className="text-muted-foreground">Resumen de pago:</div>
        <div className="font-semibold text-slate-900">{paymentSummary}</div>
      </div>
    </div>
  );
}

export default PaymentForm;

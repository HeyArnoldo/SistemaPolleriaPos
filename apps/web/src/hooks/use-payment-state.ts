import { useState, useCallback, useMemo } from 'react';
import type { PaymentMethod } from '@/types/models';
import { parseMoney, getCurrentTimeValue } from '@/lib/ventas';

export interface PaymentEntry {
  paymentMethodId: number;
  amount: string;
  transferTime?: string;
}

interface UsePaymentStateProps {
  total: number;
  paymentMethods: PaymentMethod[];
}

export function usePaymentState({ total, paymentMethods }: UsePaymentStateProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { paymentMethodId: 0, amount: '', transferTime: '' },
  ]);

  const addPaymentLine = useCallback(() => {
    setPayments((prev) => [...prev, { paymentMethodId: 0, amount: '', transferTime: '' }]);
  }, []);

  const removePaymentLine = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePayment = useCallback((index: number, patch: Partial<PaymentEntry>) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }, []);

  const setPaymentMethodForLine = useCallback(
    (index: number, methodId: number) => {
      const method = paymentMethods.find((m) => m.id === methodId);
      setPayments((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                paymentMethodId: methodId,
                transferTime: method?.requiresTransferTime ? getCurrentTimeValue() : '',
              }
            : p,
        ),
      );
    },
    [paymentMethods],
  );

  const resetPayments = useCallback(() => {
    setPayments([{ paymentMethodId: 0, amount: '', transferTime: '' }]);
  }, []);

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + parseMoney(p.amount), 0),
    [payments],
  );

  const change = useMemo(() => Math.max(0, totalPaid - total), [totalPaid, total]);

  const isValid = useMemo(() => {
    if (payments.length === 0) return false;
    for (const p of payments) {
      if (!p.paymentMethodId) return false;
      if (parseMoney(p.amount) <= 0) return false;
      const method = paymentMethods.find((m) => m.id === p.paymentMethodId);
      if (method?.requiresTransferTime && !p.transferTime) return false;
    }
    return totalPaid >= total;
  }, [payments, paymentMethods, totalPaid, total]);

  return {
    payments,
    addPaymentLine,
    removePaymentLine,
    updatePayment,
    setPaymentMethodForLine,
    resetPayments,
    totalPaid,
    change,
    isValid,
  };
}

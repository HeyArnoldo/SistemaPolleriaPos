import { useCallback, useMemo, useState } from 'react';
import { formatCurrency, getCurrentTimeValue, parseMoney } from '@/lib/ventas';
import type { CreatePaymentDTO, PaymentMethod } from '@/types/models';
import { toast } from 'sonner';

export type PaymentMode = 'single' | 'mixed';

export type PaymentState = {
  paymentMode: PaymentMode;
  singleMethodId: number;
  singleCashReceived: string;
  singleTransferTime: string;
  mixedYapeAmount: string;
  mixedCashAmount: string;
  mixedTransferTime: string;
  notes: string;
};

export type UsePaymentStateOptions = {
  total: number;
  paymentMethods: PaymentMethod[];
  paymentTolerance?: number;
};

export type UsePaymentStateReturn = {
  paymentMode: PaymentMode;
  singleMethodId: number;
  singleCashReceived: string;
  singleTransferTime: string;
  mixedYapeAmount: string;
  mixedCashAmount: string;
  mixedTransferTime: string;
  notes: string;
  cashMethod: PaymentMethod | undefined;
  yapeMethod: PaymentMethod | undefined;
  isMixedEnabled: boolean;
  singleGrossAmount: number;
  singleNetAmount: number;
  singleCommissionAmount: number;
  mixedYapeGrossAmount: number;
  mixedYapeNetAmountValue: number;
  mixedYapeCommissionAmount: number;
  mixedCashAmountValue: number;
  mixedNetTotal: number;
  mixedTotalGross: number;
  paymentsTotal: number;
  change: number;
  paymentSummary: string;
  needsTransferTime: boolean;
  isPaymentInvalid: boolean;
  canSubmit: boolean;
  setPaymentMode: (mode: PaymentMode) => void;
  setSingleMethodId: (id: number) => void;
  setSingleCashReceived: (value: string) => void;
  setSingleTransferTime: (value: string) => void;
  setMixedYapeAmount: (value: string) => void;
  setMixedCashAmount: (value: string) => void;
  setMixedTransferTime: (value: string) => void;
  setNotes: (value: string) => void;
  resetPayment: () => void;
  buildPaymentsPayload: () => CreatePaymentDTO[] | null;
};

const TRANSFER_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const isValidTransferTime = (value: string) => TRANSFER_TIME_REGEX.test(value.trim());

export const normalizePaymentMethodName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const isCashMethodName = (name: string) =>
  normalizePaymentMethodName(name).includes('efectivo');

export const isYapePlinMethodName = (name: string) => {
  const v = normalizePaymentMethodName(name);
  return v.includes('yape') || v.includes('plin');
};

export const calcGrossFromNet = (net: number, commissionPercentage: number) => {
  if (net <= 0) return 0;
  const factor = 1 + Number(commissionPercentage ?? 0) / 100;
  if (!Number.isFinite(factor) || factor <= 0) return net;
  return net * factor;
};

export const calcNetFromGross = (gross: number, commissionPercentage: number) => {
  if (gross <= 0) return 0;
  const factor = 1 + Number(commissionPercentage ?? 0) / 100;
  if (!Number.isFinite(factor) || factor <= 0) return gross;
  return gross / factor;
};

export const round2 = (value: number) => Number(value.toFixed(2));

export const getCashMethod = (methods: PaymentMethod[]) =>
  methods.find((method) => method.isActive && isCashMethodName(method.name));

export const getYapeMethod = (methods: PaymentMethod[]) =>
  methods.find((method) => method.isActive && isYapePlinMethodName(method.name));

const getDefaultSingleMethodId = (methods: PaymentMethod[]) => {
  const cash = getCashMethod(methods);
  return cash?.id ?? methods[0]?.id ?? 1;
};

export function usePaymentState({
  total,
  paymentMethods,
  paymentTolerance = 0.009,
}: UsePaymentStateOptions): UsePaymentStateReturn {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('single');
  const [singleMethodId, setSingleMethodId] = useState(getDefaultSingleMethodId(paymentMethods));
  const [singleCashReceived, setSingleCashReceived] = useState('');
  const [singleTransferTime, setSingleTransferTime] = useState('');
  const [mixedYapeAmount, setMixedYapeAmount] = useState('');
  const [mixedCashAmount, setMixedCashAmount] = useState('');
  const [mixedTransferTime, setMixedTransferTime] = useState('');
  const [notes, setNotes] = useState('');

  const cashMethod = useMemo(() => getCashMethod(paymentMethods), [paymentMethods]);
  const yapeMethod = useMemo(() => getYapeMethod(paymentMethods), [paymentMethods]);

  const isMixedEnabled = Boolean(cashMethod && yapeMethod);

  const singleMethod = useMemo(
    () => paymentMethods.find((method) => method.id === singleMethodId) ?? paymentMethods[0],
    [paymentMethods, singleMethodId],
  );

  const isSingleCash = singleMethod ? isCashMethodName(singleMethod.name) : false;

  const singleNetAmount = total;
  const singleGrossAuto = singleMethod
    ? calcGrossFromNet(total, singleMethod.commissionPercentage)
    : total;
  const singleGrossAmount = isSingleCash
    ? singleCashReceived.trim() === ''
      ? total
      : parseMoney(singleCashReceived)
    : round2(singleGrossAuto);
  const singleCommissionAmount = round2(Math.max(singleGrossAuto - total, 0));

  const mixedYapeGrossAmount = round2(parseMoney(mixedYapeAmount));
  const mixedCashAmountValue = round2(parseMoney(mixedCashAmount));
  const mixedYapeNetAmountValue = round2(
    calcNetFromGross(mixedYapeGrossAmount, Number(yapeMethod?.commissionPercentage ?? 0)),
  );
  const mixedYapeCommissionAmount = round2(
    Math.max(mixedYapeGrossAmount - mixedYapeNetAmountValue, 0),
  );
  const mixedNetTotal = round2(mixedYapeNetAmountValue + mixedCashAmountValue);
  const mixedTotalGross = round2(mixedYapeGrossAmount + mixedCashAmountValue);

  const paymentsTotal = paymentMode === 'single' ? singleGrossAmount : mixedTotalGross;

  const change =
    paymentMode === 'single' && isSingleCash ? Math.max(singleGrossAmount - total, 0) : 0;

  const needsSingleTransferTime =
    paymentMode === 'single' &&
    !isSingleCash &&
    Boolean(singleMethod?.requiresTransferTime) &&
    !isValidTransferTime(singleTransferTime);

  const needsMixedTransferTime =
    paymentMode === 'mixed' &&
    mixedYapeGrossAmount > 0 &&
    Boolean(yapeMethod?.requiresTransferTime) &&
    !isValidTransferTime(mixedTransferTime);

  const needsTransferTime = needsSingleTransferTime || needsMixedTransferTime;

  const paymentSummary = useMemo(() => {
    if (total <= 0) return 'Sin pago aun';

    if (paymentMode === 'single') {
      if (isSingleCash) {
        if (singleGrossAmount < total) {
          return `Faltan ${formatCurrency(total - singleGrossAmount)}`;
        }
        if (change > 0) return `Vuelto ${formatCurrency(change)}`;
        return 'Pago en efectivo completo';
      }
      return `Cobro digital exacto: ${formatCurrency(singleGrossAmount)} (comision ${formatCurrency(singleCommissionAmount)})`;
    }

    if (!isMixedEnabled) return 'Pago mixto no disponible';

    if (mixedNetTotal < total - paymentTolerance) {
      return `Faltan ${formatCurrency(total - mixedNetTotal)} (neto)`;
    }
    if (mixedNetTotal > total + paymentTolerance) {
      return `Excede ${formatCurrency(mixedNetTotal - total)} (sin vuelto en mixto)`;
    }

    return `Mixto exacto: Yape/Plin ${formatCurrency(mixedYapeGrossAmount)} + Efectivo ${formatCurrency(mixedCashAmountValue)}`;
  }, [
    change,
    isMixedEnabled,
    isSingleCash,
    mixedCashAmountValue,
    mixedNetTotal,
    mixedYapeGrossAmount,
    paymentMode,
    paymentTolerance,
    singleCommissionAmount,
    singleGrossAmount,
    total,
  ]);

  const isPaymentInvalid = useMemo(() => {
    if (paymentMode === 'single') {
      if (isSingleCash) {
        return singleGrossAmount < total - paymentTolerance;
      }
      return false;
    }

    if (!isMixedEnabled) return true;
    if (mixedYapeGrossAmount <= 0 || mixedCashAmountValue <= 0) return true;

    return Math.abs(mixedNetTotal - total) > paymentTolerance;
  }, [
    isMixedEnabled,
    isSingleCash,
    mixedCashAmountValue,
    mixedNetTotal,
    mixedYapeGrossAmount,
    paymentMode,
    paymentTolerance,
    singleGrossAmount,
    total,
  ]);

  const canSubmit = !isPaymentInvalid && !needsTransferTime;

  const handleSetPaymentMode = useCallback(
    (mode: PaymentMode) => {
      if (mode === 'mixed' && !isMixedEnabled) {
        toast.warning('Pago mixto solo disponible cuando existan Efectivo y Yape/Plin activos.');
        return;
      }
      setPaymentMode(mode);
      if (mode === 'mixed' && mixedTransferTime.trim() === '') {
        setMixedTransferTime(getCurrentTimeValue());
      }
    },
    [isMixedEnabled, mixedTransferTime],
  );

  const handleSetSingleMethodId = useCallback(
    (id: number) => {
      setSingleMethodId(id);
      const method = paymentMethods.find((item) => item.id === id);
      if (
        method &&
        !isCashMethodName(method.name) &&
        method.requiresTransferTime &&
        singleTransferTime.trim() === ''
      ) {
        setSingleTransferTime(getCurrentTimeValue());
      }
    },
    [paymentMethods, singleTransferTime],
  );

  const handleSetMixedYapeAmount = useCallback(
    (value: string) => {
      setMixedYapeAmount(value);
      if (
        parseMoney(value) > 0 &&
        yapeMethod?.requiresTransferTime &&
        mixedTransferTime.trim() === ''
      ) {
        setMixedTransferTime(getCurrentTimeValue());
      }
    },
    [mixedTransferTime, yapeMethod],
  );

  const resetPayment = useCallback(() => {
    setPaymentMode('single');
    setSingleMethodId(getDefaultSingleMethodId(paymentMethods));
    setSingleCashReceived('');
    setSingleTransferTime('');
    setMixedYapeAmount('');
    setMixedCashAmount('');
    setMixedTransferTime('');
    setNotes('');
  }, [paymentMethods]);

  const buildPaymentsPayload = useCallback((): CreatePaymentDTO[] | null => {
    const payments: CreatePaymentDTO[] = [];

    if (paymentMode === 'single') {
      if (!singleMethod) {
        toast.error('Selecciona un metodo de pago valido.');
        return null;
      }

      if (isSingleCash) {
        if (singleGrossAmount < total - paymentTolerance) {
          toast.error('El monto en efectivo no cubre el total.');
          return null;
        }
      } else if (singleMethod.requiresTransferTime && !isValidTransferTime(singleTransferTime)) {
        toast.error('Ingresa una hora de transferencia valida (HH:mm o HH:mm:ss).');
        return null;
      }

      payments.push({
        paymentMethodId: singleMethod.id,
        amount: round2(singleGrossAmount),
        transferTime:
          !isSingleCash && singleMethod.requiresTransferTime
            ? singleTransferTime.trim()
            : undefined,
      });

      return payments;
    }

    if (!isMixedEnabled || !cashMethod || !yapeMethod) {
      toast.error('Pago mixto no disponible con los metodos activos actuales.');
      return null;
    }

    if (mixedYapeGrossAmount <= 0 || mixedCashAmountValue <= 0) {
      toast.error('Ingresa montos validos para Yape/Plin y Efectivo en mixto.');
      return null;
    }

    if (Math.abs(mixedNetTotal - total) > paymentTolerance) {
      toast.error('En mixto, la suma neta de Yape/Plin + Efectivo debe ser exacta (sin vuelto).');
      return null;
    }

    if (yapeMethod.requiresTransferTime && !isValidTransferTime(mixedTransferTime)) {
      toast.error('Ingresa una hora de transferencia valida para Yape/Plin (HH:mm o HH:mm:ss).');
      return null;
    }

    payments.push({
      paymentMethodId: yapeMethod.id,
      amount: round2(mixedYapeGrossAmount),
      transferTime: yapeMethod.requiresTransferTime ? mixedTransferTime.trim() : undefined,
    });

    payments.push({
      paymentMethodId: cashMethod.id,
      amount: round2(mixedCashAmountValue),
    });

    return payments;
  }, [
    cashMethod,
    isMixedEnabled,
    isSingleCash,
    mixedCashAmountValue,
    mixedNetTotal,
    mixedTransferTime,
    mixedYapeGrossAmount,
    paymentMode,
    paymentTolerance,
    singleGrossAmount,
    singleMethod,
    singleTransferTime,
    total,
    yapeMethod,
  ]);

  return {
    paymentMode,
    singleMethodId,
    singleCashReceived,
    singleTransferTime,
    mixedYapeAmount,
    mixedCashAmount,
    mixedTransferTime,
    notes,
    cashMethod,
    yapeMethod,
    isMixedEnabled,
    singleGrossAmount: round2(singleGrossAmount),
    singleNetAmount: round2(singleNetAmount),
    singleCommissionAmount,
    mixedYapeGrossAmount,
    mixedYapeNetAmountValue,
    mixedYapeCommissionAmount,
    mixedCashAmountValue,
    mixedNetTotal,
    mixedTotalGross,
    paymentsTotal: round2(paymentsTotal),
    change: round2(change),
    paymentSummary,
    needsTransferTime,
    isPaymentInvalid,
    canSubmit,
    setPaymentMode: handleSetPaymentMode,
    setSingleMethodId: handleSetSingleMethodId,
    setSingleCashReceived,
    setSingleTransferTime,
    setMixedYapeAmount: handleSetMixedYapeAmount,
    setMixedCashAmount,
    setMixedTransferTime,
    setNotes,
    resetPayment,
    buildPaymentsPayload,
  };
}

export default usePaymentState;

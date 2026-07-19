type MonetaryValue = number | string | null | undefined;

export interface PaymentAmountSource {
  amount: MonetaryValue;
  grossAmount: MonetaryValue;
  netAmount: MonetaryValue;
}

export interface ReportablePaymentAmounts {
  grossAmount: number;
  netAmount: number;
}

const toAmount = (value: MonetaryValue): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export function capPaymentAmountsToSaleTotal(
  grossAmount: MonetaryValue,
  netAmount: MonetaryValue,
  saleTotal: MonetaryValue,
): ReportablePaymentAmounts {
  const gross = toAmount(grossAmount);
  const net = toAmount(netAmount);
  const parsedTotal = Number(saleTotal);
  if (saleTotal === null || saleTotal === undefined || !Number.isFinite(parsedTotal)) {
    return { grossAmount: gross, netAmount: net };
  }

  const total = Math.max(parsedTotal, 0);
  const change = Math.max(net - total, 0);

  return {
    grossAmount: Math.max(gross - change, 0),
    netAmount: Math.min(net, total),
  };
}

export function getReportablePaymentAmounts(
  payment: PaymentAmountSource,
  saleTotal: MonetaryValue,
): ReportablePaymentAmounts {
  const amount = toAmount(payment.amount);
  const storedGross = toAmount(payment.grossAmount);
  const storedNet = toAmount(payment.netAmount);
  const isLegacyPayment = storedGross === 0 && storedNet === 0 && amount !== 0;

  return capPaymentAmountsToSaleTotal(
    isLegacyPayment ? amount : storedGross,
    isLegacyPayment ? amount : storedNet,
    saleTotal,
  );
}

export function getReportablePaymentSql(paymentAlias = 'payment', saleAlias = 'sale') {
  const gross = `${paymentAlias}.grossAmount`;
  const net = `${paymentAlias}.netAmount`;
  const amount = `${paymentAlias}.amount`;
  const saleTotal = `${saleAlias}.totalAmount`;
  const legacyPayment = `${gross} = 0 AND ${net} = 0`;
  const storedGross = `CASE WHEN ${legacyPayment} THEN ${amount} ELSE ${gross} END`;
  const storedNet = `CASE WHEN ${legacyPayment} THEN ${amount} ELSE ${net} END`;
  const change = `GREATEST(${storedNet} - ${saleTotal}, 0)`;

  return {
    grossAmount: `GREATEST(${storedGross} - ${change}, 0)`,
    netAmount: `LEAST(${storedNet}, ${saleTotal})`,
  };
}

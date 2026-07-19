import {
  capPaymentAmountsToSaleTotal,
  getReportablePaymentAmounts,
  getReportablePaymentSql,
} from './payment-reporting';

describe('payment reporting amounts', () => {
  it('reports S/40 when the customer hands over S/100 for a S/40 sale', () => {
    expect(capPaymentAmountsToSaleTotal(100, 100, 40)).toEqual({
      grossAmount: 40,
      netAmount: 40,
    });
  });

  it('keeps the tendered amount separate from reportable revenue for historical rows', () => {
    expect(
      getReportablePaymentAmounts(
        { amount: '100.00', grossAmount: '100.00', netAmount: '100.00' },
        '40.00',
      ),
    ).toEqual({ grossAmount: 40, netAmount: 40 });
  });

  it('uses amount for legacy rows whose reporting columns were not populated', () => {
    expect(
      getReportablePaymentAmounts(
        { amount: '40.00', grossAmount: '0.00', netAmount: '0.00' },
        '40.00',
      ),
    ).toEqual({ grossAmount: 40, netAmount: 40 });
  });

  it('preserves the commission spread when removing an overpayment', () => {
    expect(capPaymentAmountsToSaleTotal(105, 100, 80)).toEqual({
      grossAmount: 85,
      netAmount: 80,
    });
  });

  it('builds SQL expressions that cap report values against the sale total', () => {
    const expressions = getReportablePaymentSql();

    expect(expressions.grossAmount).toContain('GREATEST');
    expect(expressions.netAmount).toContain('LEAST');
    expect(expressions.netAmount).toContain('sale.totalAmount');
  });
});

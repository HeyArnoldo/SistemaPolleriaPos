import { createSaleSchema } from '@app/contracts';

/**
 * Regression guard: TypeORM serializes decimals as strings, so the web can send
 * unitPrice/amount as numeric strings. The schema must coerce them instead of
 * rejecting with "expected number, received string" (a 400 that blocked sales).
 */
describe('createSaleSchema decimal coercion', () => {
  const base = {
    items: [{ productId: 1, quantity: 2, unitPrice: '12.50' }],
    payments: [{ paymentMethodId: 1, amount: '25.00' }],
  };

  it('coerces numeric-string unitPrice and amount to numbers', () => {
    const parsed = createSaleSchema.parse(base);
    expect(parsed.items[0].unitPrice).toBe(12.5);
    expect(parsed.payments[0].amount).toBe(25);
  });

  it('still accepts real numbers', () => {
    const parsed = createSaleSchema.parse({
      items: [{ productId: 1, quantity: 1, unitPrice: 9.9 }],
      payments: [{ paymentMethodId: 1, amount: 9.9 }],
    });
    expect(parsed.items[0].unitPrice).toBe(9.9);
  });

  it('rejects non-numeric junk', () => {
    expect(() =>
      createSaleSchema.parse({
        items: [{ productId: 1, quantity: 1, unitPrice: 'abc' }],
        payments: [{ paymentMethodId: 1, amount: 1 }],
      }),
    ).toThrow();
  });
});

/**
 * Regression guard (WU-6a): permitir "solo canje" relajó el requisito de pagos.
 * Una venta CON productos debe seguir exigiendo al menos un pago — sin él se
 * persistiría como `paid` con cero pagos. El "solo canje" (items vacíos +
 * redemptions + customerDni) sí puede ir sin pagos.
 */
describe('createSaleSchema payments requirement for product sales', () => {
  it('rejects a sale WITH items and empty payments', () => {
    const result = createSaleSchema.safeParse({
      items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
      payments: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'payments')).toBe(true);
    }
  });

  it('accepts a sale WITH items and at least one payment', () => {
    const result = createSaleSchema.safeParse({
      items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
      payments: [{ paymentMethodId: 1, amount: 10 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a solo-canje (empty items + redemptions + customerDni) with empty payments', () => {
    const result = createSaleSchema.safeParse({
      items: [],
      payments: [],
      customerDni: '12345678',
      redemptions: [{ description: 'Bebida gratis', costPoints: 20 }],
    });
    expect(result.success).toBe(true);
  });
});

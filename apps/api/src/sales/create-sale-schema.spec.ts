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

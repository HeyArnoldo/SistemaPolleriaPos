import { describe, it, expect } from 'vitest';
import { balanceSchema, projectedBalanceSchema } from '../balance';

describe('balanceSchema', () => {
  it('accepts a valid balance', () => {
    const result = balanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      balance: 250,
      version: 3,
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero balance', () => {
    const result = balanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      balance: 0,
      version: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative balance', () => {
    const result = balanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      balance: -1,
      version: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer balance', () => {
    const result = balanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      balance: 10.5,
      version: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing customerId', () => {
    const result = balanceSchema.safeParse({
      balance: 100,
      version: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('projectedBalanceSchema', () => {
  it('accepts a valid projected balance', () => {
    const result = projectedBalanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      currentBalance: 250,
      accrual: 15,
      redemption: 200,
      projectedBalance: 65,
    });
    expect(result.success).toBe(true);
  });

  it('accepts projected balance with zero accrual and redemption', () => {
    const result = projectedBalanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      currentBalance: 100,
      accrual: 0,
      redemption: 0,
      projectedBalance: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative projectedBalance', () => {
    const result = projectedBalanceSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      currentBalance: 100,
      accrual: 0,
      redemption: 200,
      projectedBalance: -100,
    });
    expect(result.success).toBe(false);
  });
});

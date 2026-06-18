import { describe, it, expect } from 'vitest';
import {
  accrueSchema,
  redeemSchema,
  mixedOperationSchema,
  reverseSchema,
  adjustSchema,
  voidMovementSchema,
} from '../operations';

describe('accrueSchema', () => {
  it('accepts a valid accrue operation', () => {
    const result = accrueSchema.safeParse({
      customerDni: '12345678',
      points: 15,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:accrual',
    });
    expect(result.success).toBe(true);
  });

  it('rejects accrue without idempotencyKey (required)', () => {
    const result = accrueSchema.safeParse({
      customerDni: '12345678',
      points: 15,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
    });
    expect(result.success).toBe(false);
  });

  it('coerces points from string', () => {
    const result = accrueSchema.safeParse({
      customerDni: '12345678',
      points: '15',
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:accrual',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.points).toBe('number');
    }
  });

  it('rejects zero or negative points', () => {
    const result = accrueSchema.safeParse({
      customerDni: '12345678',
      points: 0,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:accrual',
    });
    expect(result.success).toBe(false);
  });
});

describe('redeemSchema', () => {
  it('accepts a valid redeem operation', () => {
    const result = redeemSchema.safeParse({
      customerDni: '12345678',
      points: 200,
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:redeem',
    });
    expect(result.success).toBe(true);
  });

  it('rejects redeem without idempotencyKey (required)', () => {
    const result = redeemSchema.safeParse({
      customerDni: '12345678',
      points: 200,
      userRef: 'cajero-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('mixedOperationSchema', () => {
  it('accepts a valid mixed operation (accrue + redeem)', () => {
    const result = mixedOperationSchema.safeParse({
      customerDni: '12345678',
      accrualPoints: 15,
      redemptionPoints: 200,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:mixed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mixed operation without idempotencyKey (required)', () => {
    const result = mixedOperationSchema.safeParse({
      customerDni: '12345678',
      accrualPoints: 15,
      redemptionPoints: 200,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('reverseSchema', () => {
  it('accepts a valid reverse operation', () => {
    const result = reverseSchema.safeParse({
      customerDni: '12345678',
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:reversal',
    });
    expect(result.success).toBe(true);
  });

  it('rejects reverse without idempotencyKey (required)', () => {
    const result = reverseSchema.safeParse({
      customerDni: '12345678',
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('adjustSchema', () => {
  it('accepts a valid positive adjustment with reason', () => {
    const result = adjustSchema.safeParse({
      customerDni: '12345678',
      points: 50,
      reason: 'Compensación por inconveniente',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a negative adjustment (admin can go negative)', () => {
    const result = adjustSchema.safeParse({
      customerDni: '12345678',
      points: -50,
      reason: 'Corrección de error',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects adjustment without reason (required)', () => {
    const result = adjustSchema.safeParse({
      customerDni: '12345678',
      points: 50,
      userRef: 'admin-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects adjustment with empty reason', () => {
    const result = adjustSchema.safeParse({
      customerDni: '12345678',
      points: 50,
      reason: '',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(false);
  });

  it('does NOT require idempotencyKey (admin adjust)', () => {
    const result = adjustSchema.safeParse({
      customerDni: '12345678',
      points: 50,
      reason: 'Compensación',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(true);
  });
});

describe('voidMovementSchema', () => {
  it('accepts a valid void movement request', () => {
    const result = voidMovementSchema.safeParse({
      movementId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Error de registro',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects void without reason', () => {
    const result = voidMovementSchema.safeParse({
      movementId: '550e8400-e29b-41d4-a716-446655440000',
      userRef: 'admin-01',
    });
    expect(result.success).toBe(false);
  });
});

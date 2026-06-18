import { describe, it, expect } from 'vitest';
import { pointsMovementSchema } from '../movement';

const baseMovement = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  customerId: '550e8400-e29b-41d4-a716-446655440001',
  type: 'accrual' as const,
  points: 15,
  balanceBefore: 100,
  balanceAfter: 115,
  sede: 'sede-1',
  userRef: 'cajero-01',
  createdAt: new Date().toISOString(),
  isVoided: false,
};

describe('pointsMovementSchema', () => {
  it('accepts a valid accrual movement', () => {
    const result = pointsMovementSchema.safeParse(baseMovement);
    expect(result.success).toBe(true);
  });

  it('accepts all valid movement types', () => {
    const types = ['accrual', 'redeem', 'adjustment', 'reversal'] as const;
    for (const type of types) {
      const result = pointsMovementSchema.safeParse({ ...baseMovement, type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an invalid movement type', () => {
    const result = pointsMovementSchema.safeParse({ ...baseMovement, type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts points as a string (z.coerce.number)', () => {
    const result = pointsMovementSchema.safeParse({ ...baseMovement, points: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.points).toBe('number');
      expect(result.data.points).toBe(15);
    }
  });

  it('accepts negative points for redeem/reversal', () => {
    const result = pointsMovementSchema.safeParse({
      ...baseMovement,
      type: 'redeem',
      points: -200,
      balanceBefore: 300,
      balanceAfter: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields as absent', () => {
    const { saleRef, detail, idempotencyKey, voidedBy, voidedAt, voidReason, ...minimal } =
      baseMovement as typeof baseMovement & {
        saleRef?: string;
        detail?: string;
        idempotencyKey?: string;
        voidedBy?: string;
        voidedAt?: string;
        voidReason?: string;
      };
    const result = pointsMovementSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts isVoided as true with void metadata', () => {
    const result = pointsMovementSchema.safeParse({
      ...baseMovement,
      isVoided: true,
      voidedBy: 'admin-01',
      voidedAt: new Date().toISOString(),
      voidReason: 'Error de caja',
    });
    expect(result.success).toBe(true);
  });

  it('requires sede field', () => {
    const { sede, ...noSede } = baseMovement;
    const result = pointsMovementSchema.safeParse(noSede);
    expect(result.success).toBe(false);
  });

  it('requires userRef field', () => {
    const { userRef, ...noUserRef } = baseMovement;
    const result = pointsMovementSchema.safeParse(noUserRef);
    expect(result.success).toBe(false);
  });
});

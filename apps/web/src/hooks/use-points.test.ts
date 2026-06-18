import { describe, it, expect } from 'vitest';
import {
  calcPointsToEarn,
  calcRedemptionCost,
  calcProjectedBalance,
  buildRedemptionsPayload,
  canAffordRedemptions,
  canAddMoreRewards,
} from '@/hooks/use-points';
import type { CartItem } from '@/hooks/use-cart';
import type { Product } from '@/types/models';
import type { Reward } from '@app/carbopuntos-contracts';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const makeProduct = (id: number, price: number, puntaje?: number | null): Product => ({
  id,
  name: `Product ${id}`,
  price,
  puntaje: puntaje ?? null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  category: {
    id: 1,
    name: 'Cat',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
});

const makeCartItem = (
  productId: number,
  price: number,
  quantity: number,
  puntaje?: number | null,
): CartItem => ({
  product: makeProduct(productId, price, puntaje),
  quantity,
});

const makeReward = (id: string, costPoints: number, isActive = true): Reward => ({
  id,
  name: `Reward ${id}`,
  costPoints,
  isActive,
});

// ─── calcPointsToEarn ─────────────────────────────────────────────────────────

describe('calcPointsToEarn', () => {
  it('returns 0 for empty cart', () => {
    expect(calcPointsToEarn([])).toBe(0);
  });

  it('returns 0 when no products have puntaje', () => {
    const items = [makeCartItem(1, 20, 2, null), makeCartItem(2, 10, 3, 0)];
    expect(calcPointsToEarn(items)).toBe(0);
  });

  it('calculates puntaje × quantity for a single product', () => {
    const items = [makeCartItem(1, 73, 1, 20)];
    expect(calcPointsToEarn(items)).toBe(20);
  });

  it('sums points across multiple products', () => {
    const items = [
      makeCartItem(1, 73, 2, 20), // 2 × 20 = 40
      makeCartItem(2, 40, 1, 15), // 1 × 15 = 15
      makeCartItem(3, 8.5, 3, 0), // no points
    ];
    expect(calcPointsToEarn(items)).toBe(55);
  });

  it('ignores products with negative or null puntaje', () => {
    const items = [makeCartItem(1, 10, 2, -5), makeCartItem(2, 10, 1, null)];
    expect(calcPointsToEarn(items)).toBe(0);
  });

  it('works with fractional puntaje rounded', () => {
    // 2.5 × 2 = 5 (Math.round)
    const items = [makeCartItem(1, 10, 2, 2.5)];
    expect(calcPointsToEarn(items)).toBe(5);
  });
});

// ─── calcRedemptionCost ───────────────────────────────────────────────────────

describe('calcRedemptionCost', () => {
  it('returns 0 for empty rewards', () => {
    expect(calcRedemptionCost([])).toBe(0);
  });

  it('sums costPoints of all pending rewards', () => {
    const rewards = [makeReward('r1', 100), makeReward('r2', 170)];
    expect(calcRedemptionCost(rewards)).toBe(270);
  });

  it('handles single reward', () => {
    expect(calcRedemptionCost([makeReward('r1', 200)])).toBe(200);
  });
});

// ─── calcProjectedBalance ─────────────────────────────────────────────────────

describe('calcProjectedBalance', () => {
  it('adds accrual and subtracts redemption from current balance', () => {
    expect(calcProjectedBalance(285, 20, 100)).toBe(205);
  });

  it('clamps to 0 when result would be negative', () => {
    expect(calcProjectedBalance(50, 0, 100)).toBe(0);
  });

  it('pure accrual increases balance', () => {
    expect(calcProjectedBalance(100, 25, 0)).toBe(125);
  });

  it('pure redemption decreases balance', () => {
    expect(calcProjectedBalance(300, 0, 200)).toBe(100);
  });

  it('mixed operation: accrual and redemption together', () => {
    // balance=200, earn 30, redeem 100 → 200 + 30 - 100 = 130
    expect(calcProjectedBalance(200, 30, 100)).toBe(130);
  });
});

// ─── buildRedemptionsPayload ──────────────────────────────────────────────────

describe('buildRedemptionsPayload', () => {
  it('returns empty array for no rewards', () => {
    expect(buildRedemptionsPayload([])).toEqual([]);
  });

  it('maps each reward to the contract shape (description + costPoints)', () => {
    const rewards = [makeReward('abc-123', 100), makeReward('def-456', 200)];
    expect(buildRedemptionsPayload(rewards)).toEqual([
      { description: 'Reward abc-123', costPoints: 100 },
      { description: 'Reward def-456', costPoints: 200 },
    ]);
  });
});

// ─── canAffordRedemptions ─────────────────────────────────────────────────────

describe('canAffordRedemptions', () => {
  it('returns true when balance >= total cost', () => {
    expect(canAffordRedemptions(300, [makeReward('r1', 100), makeReward('r2', 170)])).toBe(true);
  });

  it('returns true for exact match', () => {
    expect(canAffordRedemptions(100, [makeReward('r1', 100)])).toBe(true);
  });

  it('returns false when balance < total cost', () => {
    expect(canAffordRedemptions(50, [makeReward('r1', 100)])).toBe(false);
  });

  it('returns true when no rewards are pending', () => {
    expect(canAffordRedemptions(0, [])).toBe(true);
  });
});

// ─── canAddMoreRewards ────────────────────────────────────────────────────────

describe('canAddMoreRewards', () => {
  it('returns true when at least one active reward is affordable after pending deduction', () => {
    const pending = [makeReward('r1', 100)];
    const available = [makeReward('r2', 50)];
    // balance = 200, pending = 100, remaining = 100, r2 costs 50 → can afford
    expect(canAddMoreRewards(200, pending, available)).toBe(true);
  });

  it('returns false when remaining balance is below all rewards', () => {
    const pending = [makeReward('r1', 200)];
    const available = [makeReward('r2', 100)];
    // balance = 250, pending = 200, remaining = 50, r2 costs 100 → cannot afford
    expect(canAddMoreRewards(250, pending, available)).toBe(false);
  });

  it('ignores inactive rewards', () => {
    const pending: Reward[] = [];
    const available = [makeReward('r1', 50, false)]; // inactive
    expect(canAddMoreRewards(100, pending, available)).toBe(false);
  });
});

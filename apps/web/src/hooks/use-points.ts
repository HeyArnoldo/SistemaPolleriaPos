/**
 * use-points — pure computation helpers for the Carbopuntos point system.
 *
 * All functions are pure (no side effects, no API calls), so they can be
 * unit-tested without mocks and reused in both the cashier UI and the ticket.
 *
 * Design rules (from CARBOPUNTOS-DECISIONES.md):
 *   D3  — Points are calculated per product line: puntaje × quantity (integer).
 *   RN-12 — No customer linked → no points.
 *   Points never go negative (enforced by the hub; UI guards input only).
 */

import type { CartItem } from '@/hooks/use-cart';
import type { Reward } from '@app/carbopuntos-contracts';

/** Product extended with an optional puntaje field (set via admin UI). */
export interface ProductWithPuntaje {
  id: number;
  puntaje?: number | null;
}

/**
 * Calculate the total points earned for the current cart.
 * Only products with puntaje > 0 contribute.
 */
export function calcPointsToEarn(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const puntaje = (item.product as unknown as ProductWithPuntaje).puntaje;
    if (!puntaje || puntaje <= 0) return sum;
    return sum + Math.round(puntaje * item.quantity);
  }, 0);
}

/**
 * Calculate the total redemption cost from pending reward selections.
 */
export function calcRedemptionCost(pendingRewards: Reward[]): number {
  return pendingRewards.reduce((sum, r) => sum + r.costPoints, 0);
}

/**
 * Calculate the projected balance after this transaction completes.
 *   projectedBalance = currentBalance + accrual - redemption
 * Clamped to 0 (hub enforces this; we just show the correct preview).
 */
export function calcProjectedBalance(
  currentBalance: number,
  accrual: number,
  redemption: number,
): number {
  return Math.max(0, currentBalance + accrual - redemption);
}

/**
 * Build the sale payload's redemptions array from pending reward selections.
 * Each reward maps to one redemption entry (rewardId + costPoints).
 */
export function buildRedemptionsPayload(
  pendingRewards: Reward[],
): Array<{ rewardId: string; points: number }> {
  return pendingRewards.map((r) => ({
    rewardId: r.id,
    points: r.costPoints,
  }));
}

/**
 * Determine whether a customer can afford a set of pending redemptions.
 * Used to guard the "Confirmar" button.
 */
export function canAffordRedemptions(currentBalance: number, pendingRewards: Reward[]): boolean {
  return currentBalance >= calcRedemptionCost(pendingRewards);
}

/**
 * Check if any additional reward from the catalog can still be afforded
 * after accounting for pending redemptions.
 */
export function canAddMoreRewards(
  currentBalance: number,
  pendingRewards: Reward[],
  availableRewards: Reward[],
): boolean {
  const remaining = currentBalance - calcRedemptionCost(pendingRewards);
  return availableRewards.some((r) => r.isActive && remaining >= r.costPoints);
}

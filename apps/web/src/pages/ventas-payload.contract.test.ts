/**
 * Contract boundary test (anti-drift).
 *
 * The cashier page (ventas.tsx) builds the sale-creation payload by hand. This
 * test replicates the EXACT payload shape it produces for the three real modes
 * (accrual-only, redeem-only, mixed) and pushes each through the SAME Zod schema
 * the API validates against (createSaleSchema from @app/contracts).
 *
 * If the web payload ever drifts from the contract again (e.g. snake_case
 * customer_dni, or a { rewardId, points } redemption shape), this test fails —
 * BEFORE it reaches production and gets silently .strip()'d by the API.
 *
 * Note: drift in the TYPES is already a compile error because ventas.tsx types
 * the payload as CreateSaleDTO (derived from CreateSaleInput). This test guards
 * the RUNTIME values (regex on DNI, positive integers, superRefine rules).
 */
import { describe, it, expect } from 'vitest';
import { createSaleSchema } from '@app/contracts';
import { buildRedemptionsPayload } from '@/hooks/use-points';
import type { CreateSaleDTO } from '@/types/models';
import type { Reward } from '@app/carbopuntos-contracts';

// ─── Fixtures mirroring ventas.tsx runtime state ────────────────────────────────

const makeReward = (id: string, name: string, costPoints: number): Reward => ({
  id,
  name,
  costPoints,
  isActive: true,
});

const CUSTOMER_DNI = '12345678';

/**
 * Mirror of the salePayload literal built in ventas.tsx doRegisterSale(), kept
 * structurally identical so the test exercises the production shape, not a
 * hand-tuned happy path.
 */
function buildSalePayload(opts: {
  items: Array<{ productId: number; quantity: number; unitPrice: number }>;
  payments: Array<{ paymentMethodId: number; amount: number }>;
  customerDni?: string;
  pendingRewards?: Reward[];
}): CreateSaleDTO {
  const redemptions =
    opts.pendingRewards && opts.pendingRewards.length > 0
      ? buildRedemptionsPayload(opts.pendingRewards)
      : undefined;

  return {
    saleNumber: 'V-0001',
    items: opts.items,
    payments: opts.payments,
    ...(opts.customerDni ? { customerDni: opts.customerDni } : {}),
    ...(redemptions ? { redemptions } : {}),
  };
}

describe('ventas.tsx sale payload ↔ createSaleSchema (contract boundary)', () => {
  it('accrual-only (products + payment + customer, no redemptions) is valid', () => {
    const payload = buildSalePayload({
      items: [{ productId: 1, quantity: 2, unitPrice: 73 }],
      payments: [{ paymentMethodId: 1, amount: 146 }],
      customerDni: CUSTOMER_DNI,
    });

    const result = createSaleSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerDni).toBe(CUSTOMER_DNI);
      expect(result.data.redemptions).toBeUndefined();
    }
  });

  it('redeem-only (empty items, no payments, redemptions + customer) is valid', () => {
    const payload = buildSalePayload({
      items: [],
      payments: [],
      customerDni: CUSTOMER_DNI,
      pendingRewards: [makeReward('11111111-1111-1111-1111-111111111111', 'Gaseosa', 100)],
    });

    const result = createSaleSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerDni).toBe(CUSTOMER_DNI);
      expect(result.data.redemptions).toEqual([{ description: 'Gaseosa', costPoints: 100 }]);
    }
  });

  it('mixed (products + payment + redemptions + customer) is valid', () => {
    const payload = buildSalePayload({
      items: [{ productId: 5, quantity: 1, unitPrice: 40 }],
      payments: [{ paymentMethodId: 2, amount: 40 }],
      customerDni: CUSTOMER_DNI,
      pendingRewards: [
        makeReward('11111111-1111-1111-1111-111111111111', 'Gaseosa', 100),
        makeReward('22222222-2222-2222-2222-222222222222', 'Postre', 200),
      ],
    });

    const result = createSaleSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerDni).toBe(CUSTOMER_DNI);
      expect(result.data.redemptions).toEqual([
        { description: 'Gaseosa', costPoints: 100 },
        { description: 'Postre', costPoints: 200 },
      ]);
    }
  });

  it('every redemption entry satisfies redemptionItemSchema (description + positive int costPoints)', () => {
    const payload = buildSalePayload({
      items: [],
      payments: [],
      customerDni: CUSTOMER_DNI,
      pendingRewards: [makeReward('11111111-1111-1111-1111-111111111111', 'Gaseosa', 100)],
    });

    const result = createSaleSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const r of result.data.redemptions ?? []) {
        expect(typeof r.description).toBe('string');
        expect(r.description.length).toBeGreaterThan(0);
        expect(Number.isInteger(r.costPoints)).toBe(true);
        expect(r.costPoints).toBeGreaterThan(0);
      }
    }
  });
});

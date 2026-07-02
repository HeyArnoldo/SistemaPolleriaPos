# Proposal: CP-05 + CP-06 — Reversal of canjes on cancellation & caja consistency

## Intent

When a sale that used a **canje** (point redemption) is cancelled, the customer today
**permanently loses the points they redeemed**. The hub `reverse` only compensates the
**accrual** for a `saleRef` (`points.service.ts` filters `type: 'accrual'`); the paired
`redeem` movement is never reverted. Docs confirm this gap (C15, F5, CASOS §106-114). CP-05
fixes the reversal to undo the **net** points effect of the whole sale (accrued + redeemed),
idempotently and auditable. CP-06 guarantees the **caja close/report** stays consistent for
cancelled and canje-only sales, reusing the same `cancelSale` code path CP-05 touches.

## Scope

### In Scope

- **Hub `/points/reverse` fix**: compute a single **net reversal** movement summing all
  non-voided `accrual`/`redeem`/operation movements for the `saleRef`; restore balance
  (give back redeemed points AND remove accrued), floor at 0 (D6), idempotent by key + by
  existing reversal-for-saleRef guard.
- **API sale-void cleanup**: remove the now-obsolete C15 "manual review" redeem-only
  workaround in `compensateReverse`; keep best-effort + pending-queue retry unchanged.
- **CP-06 caja consistency**: assert/guard that cancelled sales (now correctly reversed)
  stay excluded from caja totals and canje-only (total 0) sales don't distort the report.

### Out of Scope

- T2 pixel-perfect Clientes, T3 "canje desde 2da compra", HOY widget (separate backlog).
- Changing the reverse contract to return multiple movements (kept single-movement).
- New reward catalog, points tables, or DNI flows.

## Capabilities

### New Capabilities

- `carbopuntos-reversal`: full net reversal of a sale's point movements on cancellation
  (accrual + redemption), idempotent and auditable in the hub ledger.

### Modified Capabilities

- `caja-reporting`: cancelled/canje sales must not distort caja totals (verification +
  small guards; shares the `cancelSale` path with CP-05).

## Approach

Hub `reverse` stops looking only for the accrual: it aggregates the net `points` of every
non-voided movement carrying that `saleRef` and writes ONE `reversal` movement of
`-(netPoints)`, capped so the balance never goes negative. Single-movement contract is
preserved, so contracts/client/api caller and the pending-queue retry are untouched. The API
already calls `reverse` with a stable `${STORE_ID}:${saleNumber}:reversal` key — once the hub
is correct, sale-void reversal (CP-05) works end-to-end; we only delete the obsolete
redeem-only manual-review branch. CP-06 adds caja tests + guards on the shared cancel path.

## Affected Areas

| Area                                                     | Impact   | Description                           |
| -------------------------------------------------------- | -------- | ------------------------------------- |
| `apps/carbopuntos/src/points/services/points.service.ts` | Modified | Net reversal incl. redemptions        |
| `apps/api/src/sales/services/sales.service.ts`           | Modified | Drop obsolete C15 workaround          |
| `apps/api/src/sales/services/cash-report.service.ts`     | Modified | Caja guards/tests for cancelled/canje |
| `docs/CARBOPUNTOS-CASOS-Y-FLUJOS.md`, `README.md`        | Modified | Reflect corrected reversal behavior   |

## Risks

| Risk                                  | Likelihood | Mitigation                                                  |
| ------------------------------------- | ---------- | ----------------------------------------------------------- |
| Double-refund on re-reverse           | Med        | Idempotent by key + guard on existing reversal for saleRef  |
| Balance goes negative                 | Low        | Floor at 0 (D6); partial-reversal detail preserved          |
| Break existing accrual-only reverse   | Med        | Keep single-movement contract; regression tests first (TDD) |
| CP-06 real scope differs from backlog | Med        | Confirm exact wording vs shared BACKLOG.md (open question)  |

## Rollback Plan

Each slice is an independent PR revert. Reverting the hub PR restores the prior
accrual-only reverse (no schema change to undo — no migration). Reverting the API/caja PRs
restores prior behavior. No new envs, so no config rollback.

## Dependencies

- Prerequisite for CP-05 is the hub reverse fix (this change delivers it as slice 1).
- No new external services or envs.

## Success Criteria

- [ ] Cancelling a canje sale returns the redeemed points to the customer ledger.
- [ ] Double-cancel does not double-refund (idempotent).
- [ ] Redeem-only cancellation returns redeemed points (C15 no longer a manual-review case).
- [ ] Accrual-only reversal behavior unchanged (regression green).
- [ ] Cancelled/canje sales do not distort caja totals.
- [ ] lint + typecheck + build + all suites green; README updated if any step changes.

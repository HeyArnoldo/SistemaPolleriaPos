# Design: CP-05 + CP-06 — Reversal of canjes on cancellation & caja consistency

## Context

`PointsService.reverse()` (apps/carbopuntos/src/points/services/points.service.ts:385-464)
finds only the `type: 'accrual'` movement for a `saleRef` and writes a single `reversal` of
`-accrual.points`. It never accounts for the paired `redeem` movement, so cancelling a canje
sale strips the customer of redeemed points permanently. The API side already calls
`carbopuntosClient.reverse` with a stable key on `cancelSale` and enqueues transient failures
(sales.service.ts:551-603), and `compensateReverse` (270-323) carries an obsolete C15
redeem-only "manual review" log. The reverse contract returns a **single** `PointsMovement`
consumed by `@app/carbopuntos-client`, the API, and the pending-queue retry.

## Goals / Non-Goals

**Goals**

- Reverse the NET point effect (accrual + redemption) of a cancelled sale, idempotently.
- Preserve the single-movement reverse contract (no breaking change to contracts/client/api).
- Keep best-effort + pending-queue resilience: a hub outage never blocks a cancel.
- Keep caja totals correct for cancelled and canje-only sales.

**Non-Goals**

- Multi-movement reverse response, voiding original movements, or new migrations.
- Reward catalog / points-table / DNI changes; T2/T3/HOY backlog items.

## Key Decision 1 — Net single reversal vs. mirrored per-movement reversal

**Chosen: single NET reversal movement.** The hub sums `points` of every non-voided movement
carrying the `saleRef` (`accrual` +N, `redeem` -R, mixed operation's two rows) and writes ONE
`reversal` of `-(N - R) = R - N`. This restores the balance to its pre-sale value:

- Mixed (N=10, R=10): reversal 0 → balance unchanged (correct).
- Redeem-only (N=0, R=20): reversal +20 → redeemed points returned (fixes C15).
- Accrual-only (N=15, R=0): reversal -15 → prior behavior preserved (regression-safe).

Rejected: changing `reverse` to return `PointsMovement[]` (mirror each movement). That breaks
`reverseSchema`, the client, the API caller, and the pending-queue retry — far larger blast
radius for no ledger benefit. The API already sends ONE reversal key per sale, so a single net
movement is the natural fit.

## Key Decision 2 — Idempotency: key + saleRef guard

Primary idempotency stays the `idempotencyKey` UNIQUE replay (existing `insertMovementIdempotent`).
**Added defense:** before applying, if a non-voided `reversal` movement already exists for the
`saleRef`, return it without a second balance change. This makes reversal idempotent even if a
different key were ever used for the same sale (double-cancel safety), matching the D6/no-double-refund
invariant. Floor-at-0 capping and the partial-reversal `detail` audit line are retained.

## Key Decision 3 — API resilience unchanged; drop obsolete C15 branch

`cancelSale` → `tryReverse` already: best-effort, enqueue transient (`isRetryableHubError`),
never throw (D5/C5), reuse the stable key. **No behavioral change needed there.** In
`createSaleWithRedemptions.compensateReverse`, the `isRedeemOnly` "manual review" error log
(lines 285-317) becomes obsolete once the hub reverses redemptions — remove it and its test
expectation so the code stops implying redeemed points are unrecoverable. Pending-queue
`reverse` retry (pending-queue.service.ts:116-123) already reuses the stored key — untouched.

## Key Decision 4 — CP-06 caja: shared cancel path, guard + verify

The caja report (cash-report.service.ts:46-50) already filters `sale.isCanceled = false`, so a
cancelled canje sale is excluded from totals. CP-05 and CP-06 **share the `cancelSale` path**:
cancelling both reverses points (CP-05) and drops the sale from caja (CP-06). CP-06 work is
primarily **regression tests** proving: (a) a cancelled canje sale contributes 0 to caja; (b) a
canje-only sale (monetary total 0, courtesy per D4) does not distort caja net/method totals.
Add a small guard only if a test reveals a gap (e.g., total-0 rows skewing method breakdown).

> OPEN: exact CP-06 wording lives in the external shared BACKLOG.md (not in-repo). This design
> assumes CP-06 = "caja close consistency for cancelled/canje sales, sharing CP-05's cancel
> path". Confirm against BACKLOG.md before apply; scope is small and test-heavy either way.

## Data / Migrations

No schema change. `PointsMovement` already carries `saleRef`, `type`, `isVoided`,
`idempotencyKey`, and the reversal `detail`. **No migration** (hub or api). No new envs.

## Test Strategy (Strict TDD, test-first)

- Hub `points.service.spec.ts`: mixed-cancel, redeem-only cancel, accrual-only regression,
  double-cancel idempotency (same + different key), floor-at-0 partial, no-op (no movements).
- API `carbopuntos-reverse.spec.ts` / `sales.spec.ts`: cancel enqueues on transient, retry
  reconciles, obsolete redeem-only manual-review branch removed (assert log gone).
- API `cash-report` spec: cancelled canje sale excluded; canje-only sale doesn't distort totals.
- Runners: `pnpm --filter @app/carbopuntos test`, `pnpm --filter @app/api test`. Hub e2e (real
  Postgres) stays LOCAL. CI order gate: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`.

## Rollout & Delivery

Est. ~400-450 changed lines across hub + api. **Chained PRs recommended (stacked-to-main):**

- PR-1 (hub): net reversal + idempotency guard + hub tests (~180 lines) — independently mergeable.
- PR-2 (api): drop obsolete C15 branch + reverse/sale-void tests (~110 lines) — depends on PR-1
  behavior, but code is independent; stack on main after PR-1.
- PR-3 (caja): CP-06 caja consistency tests/guards + docs/README (~120 lines) — independent.

Each slice: clear start/finish, own tests, revert = independent rollback. No new env/deploy step
(README touched only to correct the documented reversal behavior).

## Risks & Mitigations

| Risk                                             | Mitigation                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Net-sum picks up unrelated movements for saleRef | Filter `isVoided=false` and exclude prior `reversal` rows from the sum |
| Regression on accrual-only reverse               | Test-first regression scenario before touching code                    |
| Double-refund                                    | Key replay + non-voided-reversal-for-saleRef guard                     |
| CP-06 scope drift vs backlog                     | Flag as open question; keep slice small/test-heavy                     |

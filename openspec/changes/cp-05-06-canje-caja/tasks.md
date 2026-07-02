# Tasks: CP-05 + CP-06 — Reversal of canjes on cancellation & caja consistency

Strict TDD (RED → GREEN → REFACTOR). Test-first every task. CI gate order per slice:
`pnpm lint && pnpm typecheck && pnpm build && pnpm test`. No `Function` type, no `require()`.
No new migrations, no new envs. Work-unit commits (tests with the code they verify).

## Review Workload Forecast

- Estimated changed lines: ~410 (hub ~180, api ~110, caja+docs ~120).
- Decision needed before apply: Yes
- Chained PRs recommended: Yes
- 400-line budget risk: Medium-High
- Recommended strategy: 3 stacked-to-main PRs (each independently mergeable; PR-2 stacks on
  main after PR-1 lands). Confirm CP-06 exact wording vs BACKLOG.md before PR-3.

---

## Slice / PR-1 — Hub net reversal (capability: carbopuntos-reversal)

Files: `apps/carbopuntos/src/points/services/points.service.ts`,
`apps/carbopuntos/src/points/services/points.service.spec.ts`.

- [x] 1.1 (RED) Test: cancel a **mixed** sale (accrue 10 + redeem 10) → single `reversal`
      `points = 0`, balance unchanged.
- [x] 1.2 (RED) Test: cancel a **redeem-only** sale (balance 50, redeem 20) → `reversal`
      `points = +20`, balance back to 50 (fixes C15).
- [x] 1.3 (RED) Regression test: cancel an **accrual-only** sale (balance 40, accrue 15) →
      `reversal` `points = -15`, balance back to 40.
- [x] 1.4 (RED) Idempotency test: double cancel with same key AND with different key/same
      `saleRef` → no second balance change.
- [x] 1.5 (RED) Floor test: reversal that would overdraw floors balance at 0 and records the
      partial reversal in `detail`.
- [x] 1.6 (RED) No-op test: reverse a `saleRef` with no movements → `reversal` `points = 0`.
- [x] 1.7 (GREEN) Rewrite `reverse()`: query all non-voided movements for
      `{customerId, saleRef}` excluding prior `reversal` rows; compute `net = Σ points`;
      write ONE `reversal` of `-net`, capped so balance floors at 0; add non-voided-reversal
      -for-saleRef idempotency guard alongside the existing key replay.
- [x] 1.8 (REFACTOR) Keep the single-`PointsMovement` return; preserve logging + `detail`
      audit string; ensure `withRetry`/optimistic-lock path intact.
- [x] 1.9 Run hub suite: `pnpm --filter @app/carbopuntos test`; then `pnpm lint && pnpm typecheck && pnpm build`.
- [x] 1.10 PR-1: chain context (start/finish, no schema change, rollback = revert).

## Slice / PR-2 — API sale-void reversal cleanup (depends on PR-1 behavior)

Files: `apps/api/src/sales/services/sales.service.ts`,
`apps/api/src/sales/carbopuntos-reverse.spec.ts`, `apps/api/src/sales/sales.spec.ts`.

- [ ] 2.1 (RED) Update test: cancelling a canje sale issues a best-effort reverse with the
      stable `${STORE_ID}:${saleNumber}:reversal` key (unchanged) and never throws.
- [ ] 2.2 (RED) Test: transient hub failure on cancel → reverse enqueued with same key;
      retry reconciles both accrued and redeemed points (net reversal).
- [ ] 2.3 (RED) Update test: remove expectation of the redeem-only "manual review" error log;
      assert it is NO longer emitted.
- [ ] 2.4 (GREEN) Remove the obsolete `isRedeemOnly` manual-review branch from
      `compensateReverse`; simplify to the plain best-effort compensating reverse. Leave
      `tryReverse`, the pending-queue retry, and idempotency-key building untouched.
- [ ] 2.5 (REFACTOR) Confirm no dead `isRedeemOnly`/`totalAccrual` plumbing remains; keep D1
      canje-online rule intact.
- [ ] 2.6 Run api suite: `pnpm --filter @app/api test`; then `pnpm lint && pnpm typecheck && pnpm build`.
- [ ] 2.7 PR-2: chain context stacked on main after PR-1; rollback = revert.

## Slice / PR-3 — CP-06 caja consistency + docs (capability: caja-reporting)

> Confirm CP-06 exact definition vs shared BACKLOG.md before starting. If wording differs,
> adjust scope with the user.

Files: `apps/api/src/sales/services/cash-report.service.ts` (+ new/updated caja spec),
`docs/CARBOPUNTOS-CASOS-Y-FLUJOS.md`, `README.md`.

- [ ] 3.1 (RED) Test: a cancelled canje sale contributes 0 to caja day totals (isCanceled filter).
- [ ] 3.2 (RED) Test: a canje-only sale (monetary total 0, courtesy D4) does not distort caja
      net/method totals or inventory sheet.
- [ ] 3.3 (GREEN) Add a guard ONLY if a test reveals a gap (e.g., total-0 rows skewing method
      breakdown); otherwise no production change beyond tests.
- [ ] 3.4 Update `docs/CARBOPUNTOS-CASOS-Y-FLUJOS.md` (C15 / cancellation flow) to state
      reversal now returns redeemed points; update `README.md` only if any step changed
      (expected: no new env/deploy step).
- [ ] 3.5 Run api suite + full CI gate: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`.
- [ ] 3.6 PR-3: chain context (independent slice); rollback = revert.

## Cross-cutting Definition of Done

- [ ] All three suites green (contracts/client unaffected; hub + api updated).
- [ ] Full CI order green from clean dist: build workspace pkgs → lint → typecheck → build → test.
- [ ] No new migration, no new env. README/docs updated for corrected reversal behavior.
- [ ] Idempotency proven (no double-refund) and accrual-only regression proven green.
- [ ] Adversarial review (judgment-day) before each PR per project convention.

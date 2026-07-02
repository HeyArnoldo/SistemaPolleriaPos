# Tasks — CP-02 Login lockout + alert

Mode: **STRICT TDD** (RED → GREEN → REFACTOR). Test runner:
`pnpm --filter @app/api test`. Every task names its concrete test first.
CI order gate: `pnpm lint` MUST pass (no `Function` type, no `require()`,
static ESM imports only) BEFORE typecheck/build/test — a lint-only failure
fails CI. Target diff <400 lines. Migration timestamp AFTER `1782959652527`.

Work units are commit-sized; each is independently green.

## WU1 — LockoutService (count + policy, fail-open)

- [x] **1.1 (RED)** Write `apps/api/src/auth/lockout.service.spec.ts`:
  - counts only `failure` rows inside the window (mock repo.count / verify the
    `where` uses `outcome:'failure'` + `MoreThanOrEqual(createdAt)`)
  - excludes rows outside the window
  - `isLocked` true at/above threshold, false below
  - default threshold 5 / window 15 when env unset; env override
    (`LOGIN_LOCKOUT_MAX_FAILURES`, `LOGIN_LOCKOUT_WINDOW_MINUTES`) respected
  - `sistema` uses `LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES` (default 20); not locked
    at 6 with normal=5; locked at/above its own threshold
  - **fail-open**: when `repo.count` throws, returns `{isLocked:false,
failureCount:0}` and logs (no throw)
- [x] **1.2 (GREEN)** Create `apps/api/src/auth/lockout.service.ts`: inject
      `Repository<LoginAudit>`; `readIntEnv` typed helper; `thresholdFor(username)`;
      `isLocked(username)` sliding-window count via `MoreThanOrEqual`; try/catch
      fail-open. No raw SQL, no `parseInt` sprawl, no `Function` type.
- [x] **1.3 (REFACTOR)** Tidy helper naming/JSDoc; run
      `pnpm --filter @app/api test` — WU1 suite green.

## WU2 — LoginLockoutAlert entity + migration

- [x] **2.1 (RED)** Write
      `apps/api/src/auth/entities/login-lockout-alert.entity.spec.ts` asserting
      metadata: `@Entity('login_lockout_alert')`, uuid PK, columns
      (`username` varchar255 NOT NULL, `sede` varchar50 nullable, `ipAddress`
      varchar45 nullable, `failureCount` int NOT NULL, `channel` varchar30 NOT NULL,
      `createdAt` @CreateDateColumn timestamptz), NO UpdateDateColumn.
- [x] **2.2 (GREEN)** Create the entity per D6 (glob-registered, no module array
      edit for entity discovery).
- [x] **2.3 (GREEN)** Create migration
      `apps/api/src/database/migrations/<ts>-CreateLoginLockoutAlert.ts` (ts >
      1782959652527): raw `CREATE TABLE IF NOT EXISTS login_lockout_alert` +
      `IDX_login_lockout_alert_created_at` (DESC); `down()` drops index then table.
- [x] **2.4 (REFACTOR)** Re-run entity spec green; confirm timestamp ordering.

## WU3 — AlertChannel seam + LogAlertChannel + AlertService

- [x] **3.1 (RED)** Write `apps/api/src/auth/alerts/log-alert-channel.spec.ts`:
      `LogAlertChannel.name === 'log'`; `send()` logs a structured line carrying
      sede + occurredAt + username + failureCount and resolves.
- [x] **3.2 (RED)** Write `apps/api/src/auth/alert.service.spec.ts`:
  - `emit()` calls `channel.send` AND persists a `login_lockout_alert` row with
    `channel = channel.name`
  - **best-effort**: `channel.send` rejection is swallowed (still persists +
    logs); repo.insert rejection is swallowed (still logs) — `emit` never throws
  - unknown/unset `LOCKOUT_ALERT_CHANNEL` resolves to `LogAlertChannel`
- [x] **3.3 (GREEN)** Create `alerts/alert-channel.ts` (interface +
      `LockoutAlertPayload`), `alerts/log-alert-channel.ts`, `alert.service.ts`
      (injects channel + `Repository<LoginLockoutAlert>`; two independent try/catch
      blocks; always logs). Channel resolution factory maps `'log'` → LogAlertChannel,
      else default. No `Function` type; static imports only.
- [x] **3.4 (REFACTOR)** Re-run WU3 suites green.

## WU4 — Wire lockout gate + alert into AuthService.login

- [x] **4.1 (RED)** Extend `apps/api/src/auth/auth.service.spec.ts`:
  - locked identity → `login` throws `TooManyAttemptsException` (429) and
    `bcrypt.compare` is NOT called (spy) and `AlertService.emit` IS called with
    username/sede/ip/failureCount
  - below-threshold → all four CP-01 branches still behave exactly as before
  - alert emit rejection does not change the thrown "too many attempts" response
  - existing 12 CP-01 tests remain green (no regression)
- [x] **4.2 (GREEN)** Create `apps/api/src/auth/too-many-attempts.exception.ts`
      (`HttpException`, status 429). Inject `LockoutService` + `AlertService` into
      `AuthService`; add lockout gate as first step of `login` per D4; add private
      `emitAlertBestEffort()` `.catch()` wrapper. Keep the optional `ctx` param and
      all CP-01 branches unchanged. Sede read from `process.env.STORE_ID` (as CP-01).
- [x] **4.3 (REFACTOR)** Re-run auth.service suite + full api suite green.

## WU5 — Module wiring

- [x] **5.1 (RED)** Extend `apps/api/src/auth/auth.module.spec.ts` (or add one)
      / or assert via an integration compile: providers include `LockoutService`,
      `AlertService`, alert channel; `forFeature` includes `LoginLockoutAlert`.
- [x] **5.2 (GREEN)** Update `auth.module.ts`: add `LoginLockoutAlert` to
      `TypeOrmModule.forFeature`; add `LockoutService`, `AlertService`, and the
      channel provider to `providers`. Static imports only.
- [x] **5.3 (REFACTOR)** Full api suite green.

## WU6 — README env documentation (SAME PR — project rule)

- [x] **6.1** Add to README env table (`## Variables de entorno`, neutral
      professional Spanish, matching existing rows): `LOGIN_LOCKOUT_MAX_FAILURES`,
      `LOGIN_LOCKOUT_WINDOW_MINUTES`, `LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES`,
      `LOCKOUT_ALERT_CHANNEL`. Add a short note on **fail-open** behavior and that
      `sistema` is throttled but never permanently locked. Flag future
      `SMTP_*`/webhook envs as deferred (only needed if a real alert channel is
      added). Update the production env block if present.

## WU7 — Gate: lint + typecheck + build + test (CI order)

- [x] **7.1** Run in CI order and confirm all green:
      `pnpm --filter @app/contracts build` (workspace) →
      `pnpm lint` (MUST pass — the CI-order gotcha) →
      `pnpm --filter @app/api typecheck` →
      `pnpm build` →
      `pnpm --filter @app/api test` (all CP-01 tests + new CP-02 suites green,
      no regressions).

## Review Workload Forecast

- Estimated changed lines: **~330** (7 new source files ~150, spec files ~140,
  auth.service/module edits ~25, README ~15). Under the 400 budget.
- Chained PRs recommended: **No** (single cohesive PR, one capability).
- 400-line budget risk: **Low**.
- Decision needed before apply: **Yes, one product decision** — whether to wire
  a real alert channel now (needs infra/creds) or ship the log/persist default.
  Default assumption: ship log/persist default; defer real delivery.

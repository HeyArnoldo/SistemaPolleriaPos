# Tasks: CP-01 Login traceability

Strict TDD RED → GREEN → REFACTOR. Runner: `pnpm --filter @app/api test` (jest,
`.spec.ts`). CI gotcha: build `@app/contracts`/`@app/carbopuntos-contracts`/
`@app/carbopuntos-client` before typecheck (CI already does this).

## Review Workload Forecast

Estimated changed lines: ~320. 400-line budget risk: Low. Chained PRs recommended:
No. Decision needed before apply: No. Single focused PR stacked off main.

## WU1 — LoginAudit entity + migration

- [ ] 1.1 RED: write `login-audit.entity.spec.ts` (or fold into the migration test)
      asserting the entity metadata: table `login_audit`, uuid PK, columns
      `username, outcome, reason, user_id, ip_address, user_agent, sede, created_at`,
      `reason`/`user_id`/`ip_address`/`user_agent`/`sede` nullable.
- [ ] 1.2 GREEN: create `apps/api/src/auth/entities/login-audit.entity.ts` per D1
      (glob-registered, `timestamptz createdAt`, no UpdateDateColumn, no FK).
- [ ] 1.3 GREEN: create migration
      `apps/api/src/database/migrations/<ts>-CreateLoginAudit.ts` per D2 with raw
      `CREATE TABLE`, index on `created_at` and composite `(username, created_at)`;
      `down()` drops the table. Timestamp AFTER `1782959652526`.

## WU2 — LoginAuditService (record + list)

- [ ] 2.1 RED: `login-audit.service.spec.ts` — `record()` inserts a row with
      `sede` from `STORE_ID`; and when the repo `insert` rejects, `record()`
      RESOLVES (does not throw) and logs. `list()` returns `findAndCount` mapped to
      `{ data, page, limit, total }` ordered by `createdAt DESC`, limit clamped.
- [ ] 2.2 GREEN: implement `apps/api/src/auth/login-audit.service.ts` per D4/D6
      (self-catching `record`, paginated `list`).

## WU3 — Wire audit into AuthService.login (4 branches)

- [ ] 3.1 RED: extend `auth.service.spec.ts` — assert `audit.record` is called with
      the right `outcome`/`reason`/`userId`/`username` for each of: success,
      bad_password, unknown_user, inactive; and that login return/throw is unchanged.
- [ ] 3.2 RED: add a best-effort test — when `audit.record` is mocked to reject,
      a valid login STILL returns user+token and a failed login STILL throws the
      original `UnauthorizedException` (D4/D5).
- [ ] 3.3 GREEN: refactor `auth.service.ts` to inject `LoginAuditService`, add the
      optional `ctx` param (default `{ ip:null, userAgent:null }`), and emit a row in
      each branch per D5.

## WU4 — Controller: context capture + admin read endpoint

- [ ] 4.1 RED: extend `auth.controller.spec.ts` — `POST /login` forwards
      `{ ip, userAgent }` from the request into `auth.login`; login response
      unchanged.
- [ ] 4.2 RED: add `GET /auth/login-audit` spec — admin gets paginated rows
      (DESC), and the endpoint is decorated with `JwtAuthGuard + RolesGuard +
  @Roles(Admin)` (assert metadata / guard rejection for non-admin).
- [ ] 4.3 GREEN: update `auth.controller.ts` — inject `@Req()` in `login`, build
      `ctx`, pass to `auth.login`; add the guarded `login-audit` GET with a Zod
      `page/limit` schema (default 20, max 100) per D6.

## WU5 — Module wiring + full suite

- [ ] 5.1 GREEN: `auth.module.ts` — add
      `TypeOrmModule.forFeature([LoginAudit])` and provide `LoginAuditService`.
- [ ] 5.2 REFACTOR/VERIFY: run `pnpm --filter @app/api test` (all green),
      typecheck after contracts build. Confirm no CarboPuntos/auth spec regressed.

## Forward-compat note for CP-02 (do NOT implement here)

CP-02 will count failures via
`SELECT count(*) FROM login_audit WHERE outcome='failure' AND (username=$1 OR
ip_address=$2) AND created_at > now() - interval 'N minutes'`. The
`(username, created_at)` index and stable `reason` enum are already in place.

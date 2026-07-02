# Tasks: Immovable "sistema" user

Strict TDD: every code task is RED → GREEN → REFACTOR. Test runner:
`pnpm --filter @app/api test` (jest, `.spec.ts`). Work units are ordered so each
commit compiles and tests pass.

## Review Workload Forecast

- Estimated changed lines: ~150 (entity + migration + seed block + guard + 2 specs).
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
- Single focused PR.

---

## Work Unit 1 — `isSystem` marker on the User entity

- [x] **T1.1 (RED)** Add `apps/api/src/users/user-entity-is-system.spec.ts`:
      assert a new `User` has `isSystem === false` by default (mirror
      `products.spec.ts` entity-default style). Run test → fails (property missing).
- [x] **T1.2 (GREEN)** Add `@Column({ type: 'boolean', default: false, name: 'is_system' }) isSystem: boolean;`
      to `user.entity.ts`. Run test → passes.
- [x] **T1.3 (REFACTOR)** Confirm no other User consumers break; `pnpm --filter @app/api typecheck`.

## Work Unit 2 — Migration adds `is_system`

- [x] **T2.1** Create migration `apps/api/src/database/migrations/<ts>-AddIsSystemToUsers.ts`
      with `up`: `ALTER TABLE "users" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false`;
      `down`: `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system"`. Follow the
      ADD COLUMN pattern in PosSchema1781200000000. (No unit test; verified by
      `migration:run` in CI/ops.)
- [x] **T2.2** Verify: `pnpm --filter @app/api build` compiles the migration.

## Work Unit 3 — Immovable guard in UsersService

- [x] **T3.1 (RED)** Add `apps/api/src/users/users-service-system-guard.spec.ts`
      with a mocked `userRepo`/`profileRepo`. Cases:
  - `update` on a user with `isSystem=true` and `isActive:false` → throws `ForbiddenException`.
  - `update` on system user with `role` change → throws.
  - `update` on system user with `username` change → throws.
  - `update` on system user with `passwordHash` change → throws.
  - `deactivate` on system user → throws.
  - `update` on a `isSystem=false` user with all fields → succeeds (no throw).
    Run → fails (no guard).
- [x] **T3.2 (GREEN)** Add a private `assertNotSystemImmutable(user, dto)` in
      `users.service.ts`; call it at the top of `update` (after `findOne`) and in
      `deactivate`. Throw `ForbiddenException` when `user.isSystem` and the dto touches
      username/role/isActive/passwordHash. Run → passes.
- [x] **T3.3 (REFACTOR)** Ensure the non-system path is unchanged; `typecheck` clean.

## Work Unit 4 — Idempotent sistema seed

- [x] **T4.1** In `run-seed.ts`, after the admin block, add a `sistema` block:
      read `process.env.SYSTEM_USER_PASSWORD`; if absent, `console.log` a clear skip
      and continue. If present and no `sistema` user exists, create profile + insert
      via `createQueryBuilder().insert()` with `role: Role.Admin`, `isSystem: true`,
      bcrypt-hashed password. If it exists, log and skip (idempotent). No hardcoded
      password.
- [x] **T4.2** Verify: `pnpm --filter @app/api build`; manual `pnpm --filter @app/api seed`
      run twice against a scratch DB creates once, skips on the second run (ops check).
      NOTE: build verified clean (no new errors from seed file); manual ops run deferred to ops.

## Work Unit 5 — Regression gate

- [x] **T5.1** Run full API suite `pnpm --filter @app/api test` — all green,
      CarboPuntos and auth specs unaffected. Before: 41 passed; after: 50 passed (+9 new).
      Pre-existing 7 suite failures unchanged (carbopuntos contracts mismatch).
- [x] **T5.2** `pnpm --filter @app/api lint` and `typecheck` clean.
      NOTE: typecheck has pre-existing errors in carbopuntos-proxy and sales.service; none from our files.

## Forward-compat reminder (not implemented here)

- [ ] Note in PR description: when CP-12 (TOTP) lands, the sistema user MUST enroll
      TOTP so it is not a 2FA bypass. No login shortcut for sistema is added here.

# Design: Immovable "sistema" user

## Context

Groow support needs a break-glass admin. PR 1 of the security block, must land
before TOTP (CP-12). Constraints: `synchronize: false` (migration required),
strict TDD, diff < 400 lines, must not break CarboPuntos or existing auth.

## Decisions

### D1 — Marker: `is_system` boolean column (not reserved username)

A dedicated `is_system` column is the guard predicate. Rationale: because the
guard also blocks renames, keying protection off the username would be circular
and fragile (a partial change could desync). A boolean column is unambiguous,
survives any rename attempt as defense-in-depth, and reads cleanly in guards.
Entity: `@Column({ type: 'boolean', default: false, name: 'is_system' }) isSystem: boolean`.

### D2 — Env-absent behavior: skip loudly, never default

The seed guards on `if (process.env.SYSTEM_USER_PASSWORD)`. When absent it logs
`[seed] SYSTEM_USER_PASSWORD not set — skipping sistema user.` and continues.
Rationale: this mirrors the existing `ADMIN_USERNAME/ADMIN_PASSWORD` skip pattern
(run-seed.ts:98,134), keeps local dev seeds runnable, and never puts a password
in the repo. Production/Coolify sets the var; a post-deploy check confirms the
user exists. Failing hard was rejected because it would break local seeding of
the unrelated catalog/admin/cashier data.

### D3 — Seed insert via queryBuilder (avoid double-hash)

Reuse the `createQueryBuilder().insert()` bypass already used for admin/cashier
(run-seed.ts:112,146). The password is bcrypt-hashed once in the seed; the
`@BeforeInsert` hook is bypassed. Idempotency via
`userRepo.findOne({ where: { username: 'sistema' } })` before insert.

### D4 — Password change is BLOCKED via the app

The guard rejects password changes on the sistema user too. Rationale: Groow
rotates the secret by updating `SYSTEM_USER_PASSWORD` in Coolify and reseeding,
NOT through the PATCH endpoint. Blocking password change closes the last mutation
vector, so "immovable" is total. (Re-seeding an existing sistema user does not
overwrite the password — the idempotent path only creates when absent; rotation
requires an explicit ops step, documented separately, out of scope here.)

### D5 — Guard placement: `UsersService`, not only the controller

The protection lives in `UsersService.update` and `deactivate`, the single
mutation chokepoint. Rationale: the controller already guards self-deactivation,
but centralizing in the service means any future caller (batch, script, another
controller) is also protected. Throw `ForbiddenException` from `@nestjs/common`.
The predicate: load the target user; if `user.isSystem` is true and the dto
touches `username`, `role`, `isActive`, or `passwordHash`, reject before saving.

### D6 — Migration is additive

A new migration adds `is_system boolean NOT NULL DEFAULT false` to `users`,
following the `ADD COLUMN ... DEFAULT` pattern in PosSchema1781200000000. Existing
rows backfill to false. `down()` drops the column. No data loss either way.

## Forward-compat note (TOTP / CP-12)

When TOTP lands, the sistema user MUST be subject to 2FA like any admin — it must
NOT be a bypass. The TOTP PR will add a `totp_secret` and enrollment; the sistema
user's secret is registered in the Groow team authenticator. This change does not
add any login shortcut for sistema, so no bypass is introduced here.

## Component impact

| Component          | Change                                                        |
| ------------------ | ------------------------------------------------------------- |
| `user.entity.ts`   | Add `isSystem` column                                         |
| migration (new)    | `ALTER TABLE users ADD COLUMN is_system ...`                  |
| `run-seed.ts`      | Add idempotent sistema block after admin block                |
| `users.service.ts` | Add `assertNotSystemImmutable` guard in `update`/`deactivate` |

No contract (Zod) change needed: `updateUserSchema` stays as-is; the guard is
server-side authorization, not input validation. No frontend change.

## Testing strategy (strict TDD, jest, colocated `.spec.ts`)

- Entity spec: `isSystem` defaults to false (mirrors products.spec.ts style).
- Service spec: guard rejects deactivate/role/rename/password on system user;
  allows all on non-system user. Use a mocked repository.
- Seed logic is covered by extracting/asserting the guard predicate at service
  level; end-to-end seed run is a manual/CI ops check (no DB in unit tests).

## Risks & mitigations

- Guard too broad → key strictly to `isSystem === true`; non-system test proves it.
- Migration ordering → timestamp after PosSchema; additive, reversible.
- Rescue lost if env unset in prod → post-deploy verification step documented.

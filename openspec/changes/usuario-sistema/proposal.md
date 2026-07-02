# Proposal: Immovable "sistema" support user

## Intent

Groow needs a guaranteed break-glass admin account ("sistema") to support the POS
before the TOTP/2FA rollout (CP-12) removes easy admin access. Today the only
admins are seeded from `ADMIN_USERNAME/ADMIN_PASSWORD`; if those credentials are
lost or the admin locks themselves out, Groow has no recovery path. This is PR 1
of the security block and must land BEFORE TOTP so a rescue account exists first.

## Scope

### In Scope

- Add `is_system` boolean column to `users` (migration, default `false`).
- Seed an immovable `sistema` user (admin role) from env `SYSTEM_USER_PASSWORD`.
  If the env var is absent, the seed SKIPS with a loud log (never invents a
  password). Idempotent: re-running does not duplicate or error.
- Protect the system user in the PATCH path: block deactivate, role change,
  rename, and password change for `is_system = true`.

### Out of Scope

- TOTP / 2FA (CP-12) — separate later PR. Design leaves a forward-compat note so
  the sistema user is NOT a 2FA bypass when TOTP lands.
- Login audit trail (CP-01), lockout + alert (CP-02).
- Any DELETE endpoint (none exists today; none is added).
- Frontend UI changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `user-management`: users gain an immovable-account invariant. The seed
  provisions a protected `sistema` admin; the update path must reject mutations
  that would remove, disable, rename, re-role, or re-password it.

## Approach

- **Marker**: boolean `is_system` column (entity `isSystem`), not a reserved
  username. Survives rename attempts and is unambiguous as a guard predicate.
- **Seed**: reuse the existing `createQueryBuilder().insert()` bypass (avoids
  double-hash), guarded by `if (SYSTEM_USER_PASSWORD)`, mirroring the admin-seed
  skip pattern. Idempotent via `findOne({ where: { username: 'sistema' } })`.
- **Protection**: guard in `UsersService.update` (and `deactivate`) that throws
  `ForbiddenException` when the target row has `isSystem = true` and the change
  touches isActive/role/username/password. PATCH already guards self-deactivation,
  so the pattern is established.

## Affected Areas

| Area                                      | Impact   | Description                      |
| ----------------------------------------- | -------- | -------------------------------- |
| `apps/api/src/users/user.entity.ts`       | Modified | Add `isSystem` column            |
| `apps/api/src/database/migrations/*`      | New      | Add `is_system` to `users`       |
| `apps/api/src/database/seeds/run-seed.ts` | Modified | Seed `sistema` user idempotently |
| `apps/api/src/users/users.service.ts`     | Modified | Guard update/deactivate          |

## Risks

| Risk                                                | Likelihood | Mitigation                                              |
| --------------------------------------------------- | ---------- | ------------------------------------------------------- |
| Seed env misconfig in Coolify leaves no rescue user | Med        | Loud skip log; documented env; verified after deploy    |
| Guard blocks legitimate admin edits on other users  | Low        | Guard predicate keyed strictly to `isSystem = true`     |
| 2FA bypass when TOTP lands                          | Med        | Forward-compat note in design: sistema MUST enroll TOTP |

## Rollback Plan

Revert the migration (`migration:revert`) drops `is_system`; revert the code
commit removes the guard and seed block. No destructive data change: the column
add is additive and the seed is idempotent, so rollback is clean.

## Dependencies

- Coolify env var `SYSTEM_USER_PASSWORD` set for production/staging.

## Success Criteria

- [ ] Migration adds `is_system` (default false); existing rows unaffected.
- [ ] Seed creates `sistema` (admin, isSystem=true) when env set; skips loudly when not; idempotent on re-run.
- [ ] PATCH cannot deactivate, re-role, rename, or re-password the sistema user.
- [ ] CarboPuntos and existing auth/login unaffected; suite green.

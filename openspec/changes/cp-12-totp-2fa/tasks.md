# Tasks: CP-12 TOTP 2FA

Strict TDD: write the failing test first, then the implementation, per work unit.
Gates before every push (CI order): `pnpm lint` → `pnpm --filter @app/api typecheck`
→ build → `pnpm --filter @app/api test`. Lint runs before tests — no `Function`
type, no `require()`, static ESM imports only. Migrations additive. Secrets never
logged/returned.

## Review Workload Forecast

- Estimated changed lines: **~900–1050** (backend + frontend, with tests).
- 400-line budget risk: **High**
- Chained PRs recommended: **Yes**
- Decision needed before apply: **Yes** (confirm chain strategy: stacked-to-main;
  confirm backup-codes deferral — see Open Questions).
- Slices: PR-a1 (backend core) → PR-a2 (backend login enforce) → PR-b (frontend),
  stacked `main ← a1 ← a2 ← b`.

---

## PR-a1 — Backend TOTP core (~350–400 lines)

Enrollment + storage only; login stays unchanged. Independently landable.

- [ ] 1. **Add `otplib` dependency** to `apps/api` (`pnpm --filter @app/api add
otplib`); confirm static import lints/builds clean. Fallback `otpauth` only if
     build breaks (design D1).
- [ ] 2. **TotpCryptoService (test-first)**: spec for `encrypt`/`decrypt`
     round-trip, tamper (bad auth tag) rejection, malformed/short key throws loudly,
     missing key throws. Implement AES-256-GCM `v1:iv:tag:ct` with `node:crypto`,
     typed key loader from `TOTP_ENCRYPTION_KEY`.
- [ ] 3. **TotpService (test-first)**: spec `generateSecret`, `buildOtpauthUri`
     (uses `TOTP_ISSUER` default), `verify` accepts current code / rejects wrong /
     honors `TOTP_WINDOW`. Implement over `otplib` `authenticator`.
- [ ] 4. **Entity + migration (test-first)**: entity spec asserts `totpSecret`
     nullable + `totpEnabled` default false; add columns to `user.entity.ts`; write
     `1782959652529-AddTotpToUsers.ts` (raw `ALTER TABLE` add both, `down` drops
     `IF EXISTS`).
- [ ] 5. **Safe-serialization guard (test-first)**: spec that `toSafeUser`
     (auth.controller) and `stripPasswordHash` (users.controller) never emit
     `totpSecret`; may expose `totpEnabled`. Add `totpSecret` to omit sets.
- [ ] 6. **Enrollment contracts**: add `confirmEnrollSchema` (6-digit) to
     `packages/contracts/src/auth.ts`; export types.
- [ ] 7. **Enrollment endpoints (test-first)**: controller spec — `POST
/auth/2fa/enroll` returns `{otpauthUri, secret}`, stores encrypted with
     `totpEnabled=false`, 403 when `current.isSystem`; `POST /auth/2fa/enroll/confirm`
     flips `totpEnabled=true` on valid code, 400 + no change on invalid; 503 when
     `TOTP_ENCRYPTION_KEY` absent. Implement in `AuthController`/`TotpService`; never
     log secret/URI.
- [ ] 8. **sistema immutability (test-first)**: extend
     `users-service-system-guard.spec.ts` — updating `sistema` `totpEnabled`/
     `totpSecret` throws; add both fields to `assertNotSystemImmutable` blocked set
     and `UpdateUserDto`.
- [ ] 9. **Seed sistema 2FA (test-first if seed is unit-testable; else manual note)**:
     in `run-seed.ts` sistema block, when `SYSTEM_TOTP_SECRET` + `TOTP_ENCRYPTION_KEY`
     present → store encrypted secret + `totpEnabled=true`; else loud log + skip.
     Idempotent (no overwrite of existing sistema).
- [ ] 10. **README (same PR)**: document `TOTP_ENCRYPTION_KEY`, `SYSTEM_TOTP_SECRET`,
      `TOTP_ISSUER`, `TOTP_WINDOW` (purpose, format, Coolify setup, absent-behavior).
- [ ] 11. **Gates green** (lint → typecheck → build → test) and open PR-a1 with chain
      context + dependency diagram (📍 a1).

## PR-a2 — Backend login enforcement (~250–300 lines) — targets PR-a1 branch

- [ ] 12. **Login contracts**: add `login2faSchema {challengeToken, code}` and the
      `twoFactorRequired` challenge response type to `packages/contracts/src/auth.ts`.
- [ ] 13. **Challenge token (test-first)**: spec sign/verify with
      `typ:'2fa_challenge'`, `sub`, expiry `TOTP_CHALLENGE_EXPIRES` (default 5m);
      reject expired/wrong-user/wrong-typ. Implement helper in `AuthService`.
- [ ] 14. **JwtStrategy rejection (test-first)**: extend `jwt.strategy` spec — a
      payload with `typ:'2fa_challenge'` is rejected; normal session unaffected.
- [ ] 15. **Two-step login (test-first)**: extend `auth.service.spec.ts` — user
      without 2FA → session issued unchanged (regression lock); user with 2FA →
      returns challenge, no session, no success audit yet. Implement the branch in
      `AuthService.login`.
- [ ] 16. **Step-2 verify (test-first)**: spec `login2fa` path — lockout re-check
      first (locked → 429), valid code → session cookie + success audit; invalid
      code → `failure`/`bad_totp` audit, no session. Add `'bad_totp'` to the audit
      reason union. Add `POST /auth/login/2fa` to `AuthController`.
- [ ] 17. **Lockout interplay (test-first)**: assert repeated `bad_totp` failures
      accumulate toward the CP-02 sliding-window threshold (reuse existing lockout —
      no new gate).
- [ ] 18. **README (same PR)**: document `TOTP_CHALLENGE_EXPIRES`.
- [ ] 19. **Gates green** and open PR-a2 with chain context + dependency diagram
      (📍 a2, depends a1).

## PR-b — Frontend (~300–350 lines) — targets PR-a2 branch

- [ ] 20. **Add QR dependency** to `apps/web` (`qrcode.react` or equivalent);
      confirm lint/build.
- [ ] 21. **Auth API client**: add `enroll2fa`, `confirm2fa`, `login2fa` to
      `services/auth.api.ts`; extend `useLogin`/hooks for the two-step response.
- [ ] 22. **Login code step (test-first where testable)**: `login.tsx` branches on
      `twoFactorRequired` → render a code-entry screen that posts `challengeToken` +
      code; error toast on invalid/locked; non-2FA path unchanged.
- [ ] 23. **Enrollment panel (admin settings)**: component that calls enroll →
      renders QR from `otpauthUri` + shows base32 for manual entry → confirm field →
      calls confirm → reflects `totpEnabled`. Admin-only surface.
- [ ] 24. **README/docs**: note the admin 2FA enrollment + login steps if user docs
      exist; no new env on the web side.
- [ ] 25. **Gates green** (web lint/typecheck/build/test) and open PR-b with chain
      context + dependency diagram (📍 b, depends a2). Do not surface enrollment UI
      until a1+a2 are merged.

---

## Cross-cutting invariants (verify in every slice)

- Users without `totpEnabled` log in exactly as today (regression test present).
- CP-01 audit reasons preserved + `bad_totp` added; CP-02 lockout not weakened.
- `sistema` guard intact; `totpSecret` never in any response or log.
- Migration additive; `down` cleanly reverts. Every new env in README same PR.

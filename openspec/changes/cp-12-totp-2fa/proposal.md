# Proposal: CP-12 — TOTP 2FA (security capstone of Phase 1)

## Why now

CP-12 is the security capstone of Phase 1. CP-01 (login audit) and CP-02 (lockout

- alert) hardened _who tried_ and _rate-limited attempts_, but the admin account is
  still single-factor: a leaked or guessed password is full compromise of a store's
  POS, its cash reports, and CarboPuntos. The authoritative decision (engram #90)
  redefined CP-12 from fingerprint to **real 2FA**: the admin logs in with password
  **plus** a TOTP code (Google Authenticator / any RFC 6238 app). This closes the
  last open credential-only path before Phase 1 is considered secure.

The break-glass `sistema` user (PR #62, engram #95) was intentionally shipped
_before_ TOTP so Groow support keeps guaranteed access during and after the 2FA
rollout. That forward-compat note is now due: `sistema` MUST be subject to TOTP
too (not a 2FA bypass) while staying unbrickable.

## What success looks like

- An admin can enroll a TOTP secret from settings (QR scan), confirm with a live
  6-digit code, and from then on every online login requires that code.
- A user **without** `totpEnabled` logs in exactly as today — zero behavior change.
- A failed TOTP code is a failed login: audited (CP-01) and counted toward lockout
  (CP-02). No new bypass of either gate.
- `sistema` is 2FA-protected via a Groow-held out-of-band secret and can always be
  recovered — never permanently locked, never a plaintext secret in the repo.
- No TOTP secret ever appears in a list/user endpoint, a log line, or any response
  except the one-time provisioning URI returned to the enrolling authenticated user.

## In scope

1. **TOTP core (backend)**: `otplib` for RFC 6238 verification. Add `totpSecret`
   (nullable, encrypted at rest) and `totpEnabled` (boolean default false) to
   `users`. Additive migration.
2. **Encryption at rest**: `totpSecret` stored AES-256-GCM-encrypted with app key
   `TOTP_ENCRYPTION_KEY` (node:crypto, no new dependency). Secret = a credential;
   a DB dump must not yield working second factors.
3. **Enrollment flow**: authenticated user generates a secret → backend returns the
   `otpauth://` provisioning URI (+ base32 for manual entry) only to the enrolling
   user; frontend renders the QR. `totpEnabled` flips true **only after** a live
   code is verified.
4. **Login flow with 2FA (two-step)**: password verified first; if `totpEnabled`,
   backend returns a short-lived signed **challenge token** instead of a session,
   and a second request (`challengeToken` + `code`) issues the session cookie.
   Preserves the CP-02 lockout gate and CP-01 audit; failed code → audit `bad_totp`
   - counts toward lockout.
5. **`sistema` & 2FA**: seed `sistema`'s TOTP secret from env `SYSTEM_TOTP_SECRET`
   (Coolify), `totpEnabled=true`. Groow holds the secret out-of-band → always
   computes a valid code → 2FA integrity preserved AND unbrickable. If
   `SYSTEM_TOTP_SECRET` is absent, skip enabling 2FA for `sistema` with a loud log
   (mirrors the `SYSTEM_USER_PASSWORD` pattern). `sistema` TOTP fields are immutable
   via API (cannot be disabled or re-enrolled through the app).
6. **Frontend**: login gains a code-entry step (per the two-step flow); admin
   settings gains an enrollment panel (QR + confirm field). Frontend ships in its
   own slice, after both backend slices.

## Out of scope (flagged as future)

- **Recovery/backup codes** — deferred to a follow-up (see design D9). The columns
  and a future `user_backup_code` table are **not precluded**; the seam is left
  open. Interim admin-lockout recovery is the `sistema` break-glass path plus
  multi-admin. See Open Questions — this is the one decision that may need the user.
- **SMS/email 2FA, WebAuthn/passkeys** — not in this change.
- **Enforcing 2FA on cashier role** — 2FA is admin-only + `sistema` for now.
  Cashiers keep single-factor login (recommended; revisit if policy changes).
- **Offline PIN interplay** — the device-local offline session (offline-pin) is a
  cached-session resilience feature, established only _after_ a full online login,
  so it already inherits the 2FA gate at establishment time. No change here.

## Constraints (hard)

- Do NOT break existing login for users without `totpEnabled`, CP-01 audit, CP-02
  lockout, the `sistema` immutability guard, or CarboPuntos.
- Strict TDD, test-first. Lint-clean (no `Function` type, no `require()`, static
  ESM imports). CI order: lint → typecheck → build → test.
- Migrations additive only (raw-SQL `ALTER TABLE`, timestamp after
  `1782959652528`).
- Secrets never logged or returned in any list/user endpoint.
- Every new env var documented in `README.md` in the same PR that introduces it.

## Size & delivery

Forecast ~900–1050 changed lines across backend + frontend → **chained/stacked
PRs required** (3 slices). See `design.md` D10 and `tasks.md` for slice boundaries.

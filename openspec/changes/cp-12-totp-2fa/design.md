# Design: CP-12 TOTP 2FA

Constraints: `synchronize:false` additive migration (raw SQL, ts after
`1782959652528`), strict TDD test-first, CI order lint→typecheck→build→test (lint
fails on `Function` type, `require()`, non-static imports), no break to
auth/CP-01/CP-02/`sistema` guard/CarboPuntos, secrets never logged or returned.
Mirrors CP-01/CP-02 precedent: service owns branch logic, best-effort side-effects
via `.catch()`, glob-registered entities, typed helpers, literal `'sistema'`
sentinel where the gate runs before user lookup.

Current auth (verified in code):

- `POST /auth/login {username,password}` → `AuthService.login` (CP-02 lockout gate →
  `findByUsername` → active/hash checks → `bcrypt.compare` → CP-01 success audit →
  `jwt.sign({sub,username,role})`) → controller sets httpOnly cookie `app_session`
  (`SESSION_COOKIE`), returns `toSafeUser`. No token in body.
- `JwtStrategy` reads the cookie only; `validate` loads user, checks `isActive`.
- CP-02 `LockoutService.isLocked(username)` counts `login_audit` failure rows in a
  sliding window → any `outcome:'failure'` row auto-counts toward lockout.

## D1 — TOTP library: `otplib`

Use `otplib` (`authenticator`) for RFC 6238 verify/generate. Rationale: named in the
authoritative decision (#90), battle-tested, TypeScript types, `authenticator.check`
with configurable window. Static import `import { authenticator } from 'otplib'`
works under `esModuleInterop` (no `require()` → lint-clean). Configure
`authenticator.options = { window: TOTP_WINDOW(default 1) }` (±1 step / ±30s clock
tolerance). **Fallback if otplib triggers ESM/CJS build friction:** `otpauth`
(zero-dep, native ESM+TS) is a drop-in alternative — decided at apply time only if a
build breaks; default remains otplib. Wrap the lib behind a `TotpService` so the
choice is swappable and never leaks into controllers.

## D2 — Secret at rest: AES-256-GCM via `node:crypto` (RECOMMENDED, no new dep)

`totpSecret` stores an encrypted envelope, not base32 plaintext. A TOTP secret is a
standing credential; a DB dump/backup leak must not yield working second factors.

- `TotpCryptoService`: `encrypt(base32): string` → `v1:<ivB64>:<tagB64>:<ctB64>`;
  `decrypt(envelope): string`. AES-256-GCM, 12-byte random IV per write, auth tag
  verified on read. Key from `TOTP_ENCRYPTION_KEY` (32 bytes, base64 or hex; a typed
  loader validates length and throws loudly at startup/enrollment if malformed).
- Versioned prefix (`v1:`) leaves a rotation seam without a schema change.
- **If `TOTP_ENCRYPTION_KEY` is absent:** existing password login is unaffected
  (columns just stay null/false); enrollment endpoints return `503 Precondition`
  (cannot store a secret safely) with a loud log; the seed skips enabling `sistema`
  2FA loudly. Fail-safe: never store a plaintext secret, never brick password login.
- Chosen over plaintext (deferring encryption would leave standing 2FA secrets in
  the DB — unacceptable for the security capstone) and over a KMS (no infra; env key
  matches the existing `JWT_SECRET`/`SYSTEM_USER_PASSWORD` operational model).

## D3 — Login flow: TWO-STEP challenge (RECOMMENDED over single-request)

Step 1 `POST /auth/login {username,password}` — unchanged gate + password path. On
success:

- `totpEnabled=false` → set `app_session` cookie, return safe user (**identical to
  today**).
- `totpEnabled=true` → do NOT set a session cookie; return
  `{ twoFactorRequired: true, challengeToken }`.

Step 2 `POST /auth/login/2fa {challengeToken, code}` — re-check lockout, verify
challenge token, verify code, then set `app_session` and return safe user.

Why two-step over `{username,password,code}` single-request:

- **UX**: authenticator flow is "enter user+pass, then read a code" — a dedicated
  code screen (PR-b) matches how users actually operate; a wrong code re-prompts the
  code only, not the whole form.
- **Security**: challenge token is a _scoped, short-lived, non-session_ capability;
  it authorizes only completing 2FA for one user. Password-validity is already
  observable (lockout/timing), so two-step reveals nothing new, and both steps stay
  behind the CP-02 gate + CP-01 audit.
- Backward compatibility is clean: the single-step path is preserved byte-for-byte
  for non-2FA users; only 2FA users see the branch.

## D4 — Challenge token: scoped short-lived JWT, rejected by session strategy

Sign with the existing `JWT_SECRET` but a distinct claim `typ:'2fa_challenge'`,
`sub:userId`, short expiry `TOTP_CHALLENGE_EXPIRES` (default `5m`). Returned in the
**response body** (never set as the `app_session` cookie).

- `JwtStrategy.validate` MUST reject any payload with `typ==='2fa_challenge'` →
  a challenge token used as a session cookie is refused (spec scenario). Session
  tokens keep their current shape (add `typ:'session'` for symmetry; absence is
  treated as session for existing cookies during rollout).
- Step 2 verifies the challenge explicitly (`jwt.verify`, assert `typ` and `sub`),
  loads the user, decrypts the secret, `authenticator.check(code, secret)`.
- Rejected: opaque server-side challenge store (needs a table + cleanup; a signed
  short-lived token is stateless and expires itself).

## D5 — Audit + lockout integration (reuse CP-01/CP-02, no new gate)

Step 2 failure path calls the **existing** best-effort `recordAudit` with
`outcome:'failure', reason:'bad_totp'` → because CP-02 counts failure rows by
username, bad codes **auto-count toward lockout** with zero new lockout code.

- Add `'bad_totp'` to the audit reason union (typed string literal).
- Re-run `lockout.isLocked(username)` at the **start** of step 2 (cheap `count`)
  before verifying the code → prevents hammering the code endpoint; on locked →
  `TooManyAttemptsException` (same 429) + best-effort alert, mirroring step 1.
- Step 1 success for a 2FA user is NOT yet a login → do **not** write a success
  audit row at step 1; success is audited only when the session is issued in step 2.
  (Step 1 still writes failure rows for bad password as today.)

## D6 — Entity + migration (additive)

`user.entity.ts`: add

```
@Column({ type: 'varchar', length: 255, name: 'totp_secret', nullable: true })
totpSecret: string | null;
@Column({ type: 'boolean', default: false, name: 'totp_enabled' })
totpEnabled: boolean = false;
```

Migration `1782959652529-AddTotpToUsers.ts` (ts after CP-02): raw
`ALTER TABLE "users" ADD COLUMN "totp_secret" varchar(255) DEFAULT NULL` and
`ADD COLUMN "totp_enabled" boolean NOT NULL DEFAULT false`; `down` drops both
`IF EXISTS`. `toSafeUser`/`stripPasswordHash` MUST also drop `totpSecret` (add
`totpSecret` to the omit set; expose only `totpEnabled` boolean if the UI needs it).

## D7 — TotpService + enrollment endpoints

`TotpService` (in `auth/`): `generateSecret()` → base32; `buildOtpauthUri(user,
secret)` using `authenticator.keyuri(username, TOTP_ISSUER, secret)`
(`TOTP_ISSUER` default `'Pollería Carbón POS'`); `verify(code, secret)`.
Enrollment on the **current authenticated user** (JwtAuthGuard):

- `POST /auth/2fa/enroll` → reject if `current.isSystem` (403); generate secret,
  store encrypted with `totpEnabled=false`, return `{ otpauthUri, secret }` (secret
  = base32 for manual entry) **only here**.
- `POST /auth/2fa/enroll/confirm {code}` → verify against pending secret; on success
  `totpEnabled=true`, return `{ enabled: true }`; on failure 400, no state change.
- Never log the secret/URI. Contracts (`packages/contracts/src/auth.ts`):
  `twoFactorChallengeSchema`, `confirmEnrollSchema {code:/^\d{6}$/}`,
  `login2faSchema {challengeToken, code}`.

## D8 — sistema seed + immutability guard

Seed (`run-seed.ts`), in the existing `SYSTEM_USER_PASSWORD` block:

- If `SYSTEM_TOTP_SECRET` **and** `TOTP_ENCRYPTION_KEY` present → insert `sistema`
  with `totpSecret = TotpCrypto.encrypt(SYSTEM_TOTP_SECRET)`, `totpEnabled=true`.
- Else → keep `totpEnabled=false`, loud `console.log` (mirror the existing skip
  logs). Never brick, never hardcode a secret.
- Idempotent: if `sistema` already exists, do not overwrite (matches current seed).
  `assertNotSystemImmutable`: extend the blocked set with `totpEnabled` and
  `totpSecret` so the users API can never disable/rotate `sistema`'s 2FA. Enrollment
  endpoints independently reject `current.isSystem` (D7).

## D9 — Backup codes: DEFER, leave the seam (RECOMMENDED)

No backup codes in this change. Interim admin-lockout recovery = the `sistema`
break-glass path (Groow logs in as an admin-role user and can be extended to reset a
stranded admin) plus the possibility of multiple admins. The design does **not**
preclude backup codes: a future `user_backup_code` table + a `TotpService.consume`
seam can be added without touching this schema. **Flagged risk (see Open
Questions):** a single-admin store where the admin loses their phone and
`SYSTEM_TOTP_SECRET` was never set would be locked out. If the user wants zero such
risk in this slice, the minimal add is a `sistema`/admin-only "disable 2FA for user
X" endpoint (small, additive) — otherwise deferred.

## D10 — Size & chained PR plan (stacked-to-main)

Forecast ~900–1050 changed lines (with tests) → exceeds the 400-line budget →
**stacked PRs**, each independently landable:

- **PR-a1 · Backend TOTP core** (~350–400): entity cols + migration, `TotpCrypto`,
  `TotpService`, enrollment endpoints, contracts, `toSafeUser`/`stripPasswordHash`
  omit, seed `SYSTEM_TOTP_SECRET`, `sistema` immutability extension, tests. Login
  unchanged; enrollment stores but 2FA not yet enforced (no lockout risk).
- **PR-a2 · Backend login enforcement** (~250–300): two-step `AuthService`/
  controller, `/auth/login/2fa`, challenge token + `JwtStrategy` rejection, audit
  `bad_totp`, step-2 lockout re-check, contracts, tests. Targets PR-a1 branch.
- **PR-b · Frontend** (~300–350): enrollment settings panel (QR via `qrcode.react`
  or equivalent from the URI + confirm field) and login code-entry step wired to the
  two-step API. Targets PR-a2 branch. UI (and thus any user-visible 2FA) ships only
  after both backends land.

Chain: `main ← a1 ← a2 ← b` (stacked-to-main). Each slice: own tests, own README env
updates, lint-clean, clear rollback (revert the slice; additive migration `down`
drops columns). Dependency diagram belongs in each PR body (chained-pr skill).

## New env vars (documented in README in the same PR that introduces them)

- `TOTP_ENCRYPTION_KEY` (PR-a1) — 32-byte AES key (base64/hex). Required to
  enroll/verify; absent → enrollment 503, sistema 2FA skipped loudly.
- `SYSTEM_TOTP_SECRET` (PR-a1) — base32 secret for `sistema` break-glass 2FA; set in
  Coolify, held out-of-band by Groow.
- `TOTP_ISSUER` (PR-a1, optional, default `Pollería Carbón POS`) — authenticator
  label.
- `TOTP_WINDOW` (PR-a1, optional, default `1`) — verification step tolerance.
- `TOTP_CHALLENGE_EXPIRES` (PR-a2, optional, default `5m`) — challenge token TTL.

## Rejected alternatives

- Plaintext `totpSecret` (standing second-factor secrets in the DB — unacceptable
  for the capstone).
- Single-request `{user,pass,code}` (worse authenticator UX, re-sends password on
  wrong code; no security gain).
- Server-side challenge store (needs table + GC; stateless signed token self-expires).
- Backend-rendered QR image (extra dep + payload; frontend renders from the URI).
- Loading `User` to decide sistema handling in the lockout gate (gate runs before
  lookup — keep the literal `'sistema'` sentinel per CP-02 D3).

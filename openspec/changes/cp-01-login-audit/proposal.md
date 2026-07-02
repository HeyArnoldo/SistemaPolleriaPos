# Proposal: CP-01 Login traceability (login audit trail)

## Intent

PR 2 of the security block. After the Calca incident there is **no record of who
tried to log in, from where, or whether it succeeded**. Today `AuthService.login`
silently throws `UnauthorizedException` on unknown user / inactive account / wrong
password and leaves no trace. Without an audit trail there is no way to
investigate suspicious access, and CP-02 (lockout after N failed attempts + alert)
has nothing to count.

Success = every login attempt (success and failure) produces one append-only audit
row capturing enough to (a) investigate the Calca-style incident and (b) let CP-02
later count failures per user/IP without re-instrumenting the auth path.

## Scope

**IN**

- New append-only entity `LoginAudit` + migration (glob-registered, `timestamptz`).
- Hook `AuthService.login` to record **one row per attempt** on BOTH outcomes:
  - `success`
  - `failure` with a machine-readable reason: `unknown_user`, `inactive`,
    `bad_password`.
- Capture per attempt: attempted `username` (even when the user does not exist),
  `outcome`, `reason` (null on success), `userId` (null on failure/unknown),
  `ipAddress`, `userAgent`, `sede` (from `STORE_ID` env), `createdAt` (timestamptz).
- Best-effort write: an audit insert failure MUST NOT break login.
- Admin-only read endpoint `GET /api/auth/login-audit` — paginated, most-recent-first.

**OUT (later PRs — do NOT build here)**

- CP-02: counting failed attempts, lockout, alerting. This change only guarantees
  the schema RECORDS enough for CP-02 to count later (see forward-compat note).
- CP-12: TOTP / 2FA.
- Retention/purge job, log export, per-sede aggregation dashboards.
- Frontend UI beyond the raw admin JSON endpoint.

## Approach

Move IP/user-agent capture to the **controller** (where the `Request` lives) and
pass a small `LoginContext { ip, userAgent }` into `AuthService.login`. The service
already owns the three failure branches, so it is the single correct place to emit
audit rows — it records the outcome in each branch and on success, then re-throws.

`STORE_ID` (already validated in env) identifies the sede: this POS runs one API
instance per sede, so there is no per-request sede — reading the env is correct and
zero-cost.

Audit writes go through a thin `LoginAuditService.record(...)` that swallows its own
errors (logs and returns) so a DB hiccup on the audit table can never convert a
valid login into a 500. This is the deliberate **best-effort** failure policy: an
audit table is observability, not a correctness gate on authentication.

The read surface is intentionally the **smallest useful slice**: a single admin-only
paginated endpoint returning recent attempts. That is exactly what an investigator
needs for the Calca incident, reuses the existing `JwtAuthGuard + RolesGuard +
@Roles(Admin)` pattern, and adds almost no surface area. A richer filter/search UI
is deferred until there is a concrete need.

## Rationale for key decisions

- **Best-effort audit** — authentication availability outranks audit completeness;
  a failed audit insert must never lock a legitimate cashier out during service.
- **Reason enum, not free text** — CP-02 will filter on `reason IN (bad_password,
unknown_user)`; a stable enum keeps that query trivial.
- **Store attempted username even when unknown** — the Calca question is "who tried",
  which includes non-existent usernames (spray attempts).
- **Append-only** — no updates/deletes in this change; the table is an evidence log.

## Privacy / PII note

Stored PII: attempted `username` + `ipAddress`. Both are strictly needed for the
security purpose (identify who/where). Retention policy (purge after N days) is
**deferred to a later PR** — noted here so it is not forgotten, but a purge job is
out of the tight CP-01 slice.

# login-audit (delta) — CP-01 Login traceability

## ADDED Requirements

### Requirement: Record every login attempt

The system SHALL persist exactly one append-only `LoginAudit` row for every login
attempt processed by `AuthService.login`, on both success and failure, capturing:
attempted `username`, `outcome`, `reason`, `userId`, `ipAddress`, `userAgent`,
`sede`, `createdAt`.

- Scenario: successful login
  - WHEN valid credentials are submitted
  - THEN one row is written with `outcome='success'`, `reason=null`,
    `userId=<the user id>`, `username=<submitted username>`
  - AND the login still returns the user + token unchanged.

- Scenario: wrong password
  - WHEN an existing active user submits a wrong password
  - THEN one row is written with `outcome='failure'`, `reason='bad_password'`,
    `userId=<the user id>`
  - AND login still throws `UnauthorizedException('Invalid credentials')`.

- Scenario: unknown username
  - WHEN the submitted username matches no user (or no passwordHash)
  - THEN one row is written with `outcome='failure'`, `reason='unknown_user'`,
    `userId=null`, `username=<the submitted username>`
  - AND login still throws `UnauthorizedException('Invalid credentials')`.

- Scenario: inactive account
  - WHEN an existing but deactivated user submits correct-looking credentials
  - THEN one row is written with `outcome='failure'`, `reason='inactive'`,
    `userId=<the user id>`
  - AND login still throws `UnauthorizedException('Account is deactivated')`.

### Requirement: Audit is best-effort and never breaks login

A failure while writing the audit row SHALL NOT change the outcome of `login`.

- Scenario: audit insert throws on a valid login
  - WHEN the audit write rejects (e.g. DB error) during an otherwise valid login
  - THEN `login` still returns the user + token (no 500, no thrown error)
  - AND the failure is logged server-side.

- Scenario: audit insert throws on a failed login
  - WHEN the audit write rejects during a failed login
  - THEN `login` still throws the original `UnauthorizedException`
    (the auth error is not masked by the audit error).

### Requirement: Capture request context

The controller SHALL capture the client `ipAddress` and `userAgent` from the
request and forward them to the login flow; `sede` SHALL be taken from the
`STORE_ID` environment variable.

- Scenario: context propagation
  - WHEN a login request arrives
  - THEN the persisted row's `ipAddress` reflects `req.ip` (trust-proxy resolved)
    and `userAgent` reflects the `User-Agent` header
  - AND `sede` equals `process.env.STORE_ID` (or null when unset).

### Requirement: Admin-only read surface

The system SHALL expose `GET /api/auth/login-audit`, guarded by
`JwtAuthGuard + RolesGuard` with `@Roles(Admin)`, returning recent attempts
most-recent-first with pagination.

- Scenario: admin lists recent attempts
  - WHEN an admin calls `GET /api/auth/login-audit?page=1&limit=20`
  - THEN the response contains up to 20 rows ordered by `createdAt` DESC
    plus pagination metadata (page, limit, total).

- Scenario: non-admin blocked
  - WHEN a cashier (or unauthenticated caller) hits the endpoint
  - THEN the request is rejected by the guards (403 / 401) and returns no rows.

## Forward-compatibility (CP-02, informative — not built here)

The schema is designed so CP-02 can count failures without touching the auth path:
`(username, ipAddress, outcome='failure', reason, createdAt)` are sufficient to
count recent failed attempts per user or per IP within a time window.

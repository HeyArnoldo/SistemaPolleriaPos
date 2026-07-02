# Spec delta — auth-lockout (CP-02)

Capability: **Login lockout and lockout alerting** on top of the CP-01
`login_audit` log. Delta relative to current auth behavior (CP-01 shipped).

## ADDED Requirements

### Requirement: Failure counting over a sliding window

The system SHALL determine whether an identity is locked by counting
`login_audit` rows with `outcome = 'failure'` for that `username` whose
`created_at` falls within the configured window ending at "now", using the
existing `(username, created_at)` composite index. The count SHALL NOT require
any new mutable counter column and SHALL be self-resetting: failures older than
the window are excluded automatically.

#### Scenario: Failures inside the window are counted

- **GIVEN** username `admin` has 4 `failure` rows in the last 5 minutes
- **AND** the window is 15 minutes
- **WHEN** the lockout count is computed for `admin`
- **THEN** the count is 4

#### Scenario: Failures outside the window are ignored

- **GIVEN** username `admin` has 6 `failure` rows all older than 20 minutes
- **AND** the window is 15 minutes
- **WHEN** the lockout count is computed for `admin`
- **THEN** the count is 0

#### Scenario: Success rows are not counted

- **GIVEN** username `admin` has 5 rows in the window, 2 of which are `success`
- **WHEN** the lockout count is computed for `admin`
- **THEN** only the 3 `failure` rows are counted

### Requirement: Lockout check before password verification

`AuthService.login` SHALL evaluate the lockout policy for the attempted
`username` BEFORE performing `bcrypt.compare`. If the identity is locked, login
SHALL be refused without evaluating the password and without leaking whether the
account exists beyond the fact that attempts are throttled.

#### Scenario: Locked identity is refused before password check

- **GIVEN** username `admin` has failure count `>=` its threshold within the window
- **WHEN** a login is attempted for `admin` with any password
- **THEN** login is refused with a distinct "too many attempts" error
- **AND** `bcrypt.compare` is NOT invoked
- **AND** no password-based success or failure branch runs

#### Scenario: Below-threshold identity proceeds to normal auth

- **GIVEN** username `admin` has failure count below its threshold
- **WHEN** a login is attempted for `admin`
- **THEN** the lockout gate passes and normal CP-01 auth branches run unchanged

### Requirement: Window-based auto-reset after cooldown

Because counting is sliding-window, a locked identity SHALL become unlocked
automatically once enough time passes for prior failures to fall outside the
window; no manual unlock and no successful-login side effect SHALL be required.

#### Scenario: Identity unlocks after the window elapses

- **GIVEN** username `admin` is locked from failures at time T
- **WHEN** the current time is later than T + window and no new failures occurred
- **THEN** the lockout count is below threshold and login proceeds to normal auth

#### Scenario: A successful login does not require an explicit counter reset

- **GIVEN** username `admin` had failures then a genuine credential
- **WHEN** the count is below threshold and the password is correct
- **THEN** login succeeds and no counter-reset write is performed

### Requirement: Configurable policy defaults

The failure threshold and window SHALL be configurable via environment
variables with safe defaults (`LOGIN_LOCKOUT_MAX_FAILURES` default `5`,
`LOGIN_LOCKOUT_WINDOW_MINUTES` default `15`). Invalid or missing values SHALL
fall back to the documented defaults. These env vars SHALL be documented in
README in the same change.

#### Scenario: Env override changes the threshold

- **GIVEN** `LOGIN_LOCKOUT_MAX_FAILURES=3`
- **WHEN** an identity reaches 3 failures within the window
- **THEN** the identity is locked

#### Scenario: Missing env uses defaults

- **GIVEN** neither lockout env var is set
- **WHEN** the policy is evaluated
- **THEN** the threshold is 5 and the window is 15 minutes

### Requirement: System (break-glass) user is rate-limited but never permanently locked

The immovable `sistema` user (identified by `username = 'sistema'`) SHALL be
subject to a distinct, more lenient threshold so it is still throttled under
brute-force, but SHALL never be permanently locked out: because counting is
sliding-window, waiting out the window always restores access. Its threshold
SHALL be configurable (`LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES` default `20`).

#### Scenario: sistema user throttled at its own higher threshold

- **GIVEN** `sistema` has 6 failures in the window and the normal threshold is 5
- **AND** the system threshold is 20
- **WHEN** the lockout policy is evaluated for `sistema`
- **THEN** `sistema` is NOT locked (below its own higher threshold)

#### Scenario: sistema user is still throttled at its own threshold

- **GIVEN** `sistema` has failures `>=` the system threshold within the window
- **WHEN** a login is attempted for `sistema`
- **THEN** it is refused with the "too many attempts" error until the window clears

### Requirement: Fail-open on count-query failure

If the failure-count query throws, the system SHALL log the error and allow the
login attempt to proceed to normal authentication (fail-open). A lockout
evaluation error SHALL NEVER turn a valid login into a 500 and SHALL NEVER lock
an identity by default.

#### Scenario: Count query error does not block login

- **GIVEN** the failure-count query throws a database error
- **WHEN** a login is attempted
- **THEN** the error is logged
- **AND** the login proceeds to normal password verification (not refused as locked)

### Requirement: Lockout alert is persisted and logged (best-effort)

When a lockout is triggered on a login attempt, the system SHALL persist a
`login_lockout_alert` row and emit a structured log line, both carrying at least
`sede` and the event `time`, plus `username`, `ipAddress`, and the `failureCount`
that tripped the threshold. Alert emission SHALL be best-effort: a persistence
or delivery failure SHALL NEVER break or change the login response.

#### Scenario: Lockout persists an alert with sede and time

- **GIVEN** a login attempt trips the lockout threshold for `admin` at sede `sede-calca`
- **WHEN** the attempt is refused
- **THEN** a `login_lockout_alert` row exists with `username=admin`, `sede=sede-calca`, a `createdAt` time, and the tripping `failureCount`

#### Scenario: Alert persistence failure does not break login response

- **GIVEN** the alert persistence throws
- **WHEN** a lockout is triggered
- **THEN** the error is logged
- **AND** the caller still receives the "too many attempts" response (not a 500)

### Requirement: Pluggable alert delivery channel with log/no-op default

Alert delivery SHALL be behind an `AlertChannel` interface. The default bound
implementation SHALL be a log/no-op channel requiring no external
infrastructure. Selection MAY be driven by an env var
(`LOCKOUT_ALERT_CHANNEL` default `log`); unknown/unset values SHALL resolve to
the log/no-op default. Real channels (email/webhook/hub) are out of scope for
this change and, if later added, SHALL require their own documented env.

#### Scenario: Default channel is the log/no-op implementation

- **GIVEN** `LOCKOUT_ALERT_CHANNEL` is unset
- **WHEN** an alert is emitted
- **THEN** the log/no-op channel handles it and no external delivery is attempted

#### Scenario: Unknown channel value falls back to log/no-op

- **GIVEN** `LOCKOUT_ALERT_CHANNEL=carrier-pigeon`
- **WHEN** the channel is resolved
- **THEN** the log/no-op channel is used

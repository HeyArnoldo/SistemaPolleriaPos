# Spec delta: auth-2fa (CP-12 TOTP two-factor authentication)

Capability: online authentication gains an optional TOTP second factor for admin
and the `sistema` break-glass user, without changing behavior for users that have
not enabled it.

## ADDED Requirements

### Requirement: TOTP secret storage on the user

The system SHALL store a per-user TOTP secret and an enabled flag, and SHALL never
expose the secret through any user-listing or user-detail response.

- `users.totpSecret` — nullable, holds the TOTP secret **encrypted at rest**
  (AES-256-GCM, key `TOTP_ENCRYPTION_KEY`). Plaintext secrets are never persisted.
- `users.totpEnabled` — boolean, default `false`.
- The migration is additive (adds two nullable/defaulted columns); no existing row
  is invalidated.

#### Scenario: secret never leaves the API in list/detail

- **WHEN** an admin calls `GET /users` or any user-detail endpoint
- **THEN** the response contains neither `totpSecret` nor the decrypted secret,
  and MAY expose only the boolean `totpEnabled`.

#### Scenario: secret is encrypted before persistence

- **WHEN** a TOTP secret is written to `users.totpSecret`
- **THEN** the stored value is an AES-256-GCM ciphertext envelope, never the raw
  base32 secret.

#### Scenario: existing users are unaffected by the migration

- **WHEN** the migration runs against a database of pre-CP-12 users
- **THEN** every existing user gets `totpEnabled=false`, `totpSecret=NULL`, and can
  log in exactly as before.

### Requirement: TOTP enrollment for the authenticated user

An authenticated user SHALL be able to generate a TOTP secret and activate 2FA only
by proving possession of the authenticator, in two calls.

#### Scenario: begin enrollment returns a provisioning URI

- **WHEN** an authenticated admin requests enrollment start
- **THEN** the API generates a fresh secret, stores it **encrypted** with
  `totpEnabled` still `false`, and returns the `otpauth://` provisioning URI (and
  the base32 secret for manual entry) **only** in that response.

#### Scenario: 2FA is not enabled until a live code is verified

- **WHEN** the user submits a 6-digit code that verifies against the pending secret
- **THEN** `totpEnabled` becomes `true`.
- **WHEN** the submitted code is invalid
- **THEN** `totpEnabled` stays `false` and the enrollment is not completed.

#### Scenario: sistema cannot enroll or change TOTP via the API

- **WHEN** the current user is the `sistema` user and calls any enrollment endpoint
- **THEN** the request is rejected (forbidden); `sistema`'s TOTP is env-managed only.

### Requirement: Two-step login with TOTP challenge

When a user has `totpEnabled`, the system SHALL require a valid TOTP code before
issuing a session, using a short-lived challenge token; users without `totpEnabled`
SHALL continue to log in in a single step exactly as today.

#### Scenario: user without 2FA logs in unchanged

- **WHEN** a user with `totpEnabled=false` posts valid username + password
- **THEN** the API sets the `app_session` cookie and returns the safe user, with no
  code prompt — identical to pre-CP-12 behavior.

#### Scenario: user with 2FA receives a challenge, not a session

- **WHEN** a user with `totpEnabled=true` posts valid username + password
- **THEN** the API does NOT set a session cookie and instead returns a short-lived
  challenge token indicating a second factor is required.

#### Scenario: valid code completes the login

- **WHEN** the challenge token is presented with a valid current TOTP code
- **THEN** the API sets the `app_session` cookie, returns the safe user, and writes
  a CP-01 success audit row.

#### Scenario: challenge token cannot be used as a session

- **WHEN** the challenge token is presented as the `app_session` cookie to any
  protected route
- **THEN** the JWT strategy rejects it (it is not a session token).

#### Scenario: expired or malformed challenge is rejected

- **WHEN** the challenge token is expired, malformed, or for a different user
- **THEN** the code-verification step fails without issuing a session.

### Requirement: Failed TOTP is a failed login (audit + lockout)

A failed TOTP verification SHALL be treated as a failed login attempt for CP-01
audit and CP-02 lockout purposes.

#### Scenario: bad code is audited

- **WHEN** the second step is submitted with an invalid code
- **THEN** a CP-01 audit row is written with outcome `failure` and reason
  `bad_totp`, and no session is issued.

#### Scenario: bad code counts toward lockout

- **WHEN** repeated invalid codes accumulate for a username within the lockout
  window
- **THEN** those failures count toward the CP-02 sliding-window threshold and the
  account is locked out on the same terms as bad-password failures.

#### Scenario: lockout gate still guards the second step

- **WHEN** a username is already locked out
- **THEN** the code-verification step rejects with the lockout response before
  verifying the code, just as the password step does.

### Requirement: sistema break-glass 2FA from environment

The `sistema` user SHALL be TOTP-protected from a Groow-held out-of-band secret and
SHALL remain recoverable and immutable via the API.

#### Scenario: sistema seeded with env TOTP secret

- **WHEN** the seed runs with `SYSTEM_TOTP_SECRET` set
- **THEN** `sistema` is created with that secret stored encrypted and
  `totpEnabled=true`, so Groow can always compute a valid code.

#### Scenario: sistema without env secret skips 2FA loudly

- **WHEN** the seed runs and `SYSTEM_TOTP_SECRET` (or `TOTP_ENCRYPTION_KEY`) is
  absent
- **THEN** `sistema` is created/kept with `totpEnabled=false` and a loud log line is
  emitted, mirroring the `SYSTEM_USER_PASSWORD` skip pattern (never brick access).

#### Scenario: sistema TOTP fields are immutable via API

- **WHEN** any request attempts to change `sistema`'s `totpEnabled` or `totpSecret`
  through the users API
- **THEN** the request is rejected by the immutability guard.

## MODIFIED Requirements

### Requirement: Login endpoint contract

The login flow becomes two-step for 2FA-enabled users while remaining single-step
and backward-compatible for everyone else.

#### Scenario: response shape branches on 2FA

- **WHEN** `POST /auth/login` succeeds on password
- **THEN** the response is the safe user + session cookie (no 2FA), OR a
  `twoFactorRequired` challenge payload with no session cookie (2FA enabled), and a
  second endpoint completes the code step.

#### Scenario: existing generic error messages are preserved

- **WHEN** password verification fails or the user is unknown/inactive
- **THEN** the existing `Invalid credentials` / deactivation behavior and CP-01
  audit reasons are unchanged (no enumeration regression).

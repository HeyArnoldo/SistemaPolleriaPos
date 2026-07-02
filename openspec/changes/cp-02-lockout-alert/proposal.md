# CP-02 — Login lockout + lockout alert

## Why (intent)

CP-01 gave us an append-only `login_audit` table that records every login
attempt (success/failure, reason, username, ip, sede, timestamp) with a
composite index `(username, created_at)`. It records history but does **nothing**
to stop an attack in progress. The Calca incident — repeated failed logins
against a sede with nobody noticing — is exactly the gap: we can now _see_ the
attempts after the fact, but we cannot _block_ them and we cannot _alert_
anyone in real time.

CP-02 turns that passive log into an active control:

1. **Lockout**: after too many failed attempts for an identity in a short
   window, block further login attempts for a cooldown period — throttling
   online brute-force / credential-stuffing at the sede.
2. **Alert**: when a lockout triggers, emit a best-effort alert carrying
   **sede and time** so an operator/central hub can react while the attack is
   still happening (the concrete Calca driver).

### Success looks like

- A username that fails N times inside the window is refused _before_ password
  verification for the cooldown, with a clear message, until the window clears.
- A legitimate user who then waits out the window (or whose window naturally
  rolls off) can log in again — no manual unlock needed.
- Every lockout produces a persisted `login_lockout_alert` row **and** a
  structured log line carrying `sede` + `time`, regardless of whether any
  external delivery channel is configured.
- The break-glass `sistema` user is never permanently locked out, but is still
  rate-limited so it cannot be freely brute-forced.
- Thresholds and cooldown are env-configurable and documented in README in the
  same PR.
- CP-01 audit, existing auth/login, and CarboPuntos keep working unchanged; CI
  (lint → typecheck → build → test) stays green.

## What changes

- Add a **lockout policy check** in `AuthService.login`, running **before**
  password verification, that counts recent `failure` rows in `login_audit`
  for the identity via the existing composite index and, above threshold,
  refuses with a distinct "too many attempts" error.
- Add a **`LockoutService`** encapsulating the count query + policy decision
  (threshold, window, cooldown, fail-open behavior, `sistema` special rule).
- Add a **`login_lockout_alert`** entity + migration to persist each lockout
  event (username, sede, time, ip, failure count, trigger reason).
- Add an **`AlertChannel` interface** with a default no-op/log implementation,
  so alert _delivery_ is pluggable and deferrable without hard-depending on
  infra (email/webhook/hub) that isn't set up yet.
- Add **env vars** for policy tuning + alert channel selection, documented in
  README.

## In scope

- Failure counting against `login_audit` reusing `(username, created_at)`.
- Lockout decision + distinct "too many attempts" response in `AuthService.login`.
- Special, non-permanent policy for the `sistema` break-glass user.
- `login_lockout_alert` persistence (entity + migration).
- Structured log alert carrying sede + time on every lockout.
- Pluggable `AlertChannel` seam with a log/no-op default implementation.
- Env-var configuration + README documentation, in the same PR.
- Strict-TDD tests for every new unit and every new branch.

## Out of scope (non-goals)

- **TOTP / 2FA** — that's CP-12, explicitly separate.
- **Real email/SMTP or webhook/hub delivery** of alerts — only the _seam_ and
  the log/persist default ship now. SMTP/webhook envs are _flagged_ for README
  as future/optional; no live delivery is wired.
- **An admin unlock endpoint / lockout dashboard** — cooldown auto-expires;
  manual unlock UI is a later refinement.
- **IP-only or global rate limiting middleware** (e.g. per-route throttler) —
  we scope to identity-based lockout driven by the audit log.
- **Retention/purge** of alert rows — same deferral posture as CP-01 audit.

## Approach (outline + rationale)

- **Reuse the audit log as the counter.** We already write a `failure` row for
  every bad attempt (`bad_password`, `unknown_user`, `inactive`). Counting
  recent failures over the `(username, created_at)` index is O(log n + k) and
  needs **no new failure-counter column** and **no reset logic**: a _sliding
  window_ count is self-resetting — a successful login stops producing failure
  rows, so old failures roll off the window naturally. This is the simplest
  correct design and avoids a mutable counter that could drift.

- **Lock by username, not IP (recommended).** Rationale below in Decisions.

- **Check before password verify.** Placing the lockout gate before
  `bcrypt.compare` both saves the (expensive) hash under attack and guarantees
  a locked identity cannot be probed by password — matching the CP-01 branch
  layout in `AuthService.login`.

- **Best-effort, fail-**OPEN** on count error.** If the count query throws, we
  log and allow the login attempt to proceed to normal auth. Rationale in
  Decisions — availability of a legit admin during a DB hiccup outweighs the
  narrow window an attacker gains, and normal password auth still guards the
  door.

- **Persist + log now, deliver later.** The alert is _always_ persisted and
  logged (durable, infra-free). Delivery is behind an `AlertChannel` interface
  whose default is a log/no-op, so email/webhook/hub can be added later by
  providing another implementation — no redesign, no infra dependency today.

## Key decisions (summary — full justification in design.md)

- **Lockout keyed by `username`** (not IP, not both). CP-01 indexed
  `(username, created_at)`, not IP; the driver is protecting _accounts_ at a
  sede behind (often) one shared NAT IP, where IP-locking would lock out the
  whole sede on one attacker and is trivially bypassed by rotating IPs.
  Username-locking is index-aligned, precise, and matches the threat.
- **Defaults: N = 5 failures / 15-min window / 15-min cooldown**, all
  env-overridable (`LOGIN_LOCKOUT_MAX_FAILURES`, `LOGIN_LOCKOUT_WINDOW_MINUTES`).
  With a sliding window, window == effective cooldown, so no separate cooldown
  env is needed (kept simple).
- **`sistema` user: rate-limited, never hard-locked.** It gets a _higher_
  threshold and the same sliding window, so an attacker is still throttled, but
  because counting is sliding-window the account is never permanently bricked —
  waiting out the window restores access. No admin-unlock dependency for the
  break-glass account.
- **Fail-OPEN** on count-query failure (justified above).
- **Distinct `429`-style "too many attempts" response** is acceptable and does
  NOT meaningfully worsen enumeration: an attacker triggering lockout already
  knows they've been hammering _that_ username; the generic
  "Invalid credentials" message stays for the normal bad-password/unknown-user
  branches, so existence is not leaked on a single wrong password.
- **Alert delivery pluggable, default log/no-op.** Persist + structured log
  ship now; SMTP/webhook/hub are flagged env for later, no live wiring.

## Open questions for the user

1. **Alert channel that needs infra** — is there an existing central hub
   endpoint (the CarboPuntos hub?) or an SMTP account the alert should target
   _now_, or do we ship the log/persist default and defer real delivery? The
   design ships the seam either way; wiring a live channel needs the endpoint
   URL / SMTP creds, which are infra decisions.
2. **Default threshold/window** — are N=5 / 15 min acceptable for a busy sede
   counter (cashiers do fat-finger), or should the sede-facing threshold be
   more lenient?

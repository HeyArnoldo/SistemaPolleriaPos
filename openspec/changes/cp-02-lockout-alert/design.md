# Design — CP-02 Login lockout + alert

Constraints (inherited): `synchronize:false` (migration only), strict TDD,
diff <400 lines, no break to auth/CP-01 audit/CarboPuntos, CI order
lint → typecheck → build → test (lint fails the build — no `Function` type,
no `require()`, only typed handler aliases and static ESM imports).

Precedent to follow: CP-01 design (glob-registered entity, best-effort service
with try/catch that never rethrows, service owns the branch logic, optional
ctx param for backward compat, raw-SQL migration timestamped after the previous
one). We mirror all of it.

---

## D1 — Lock by `username` (not IP, not both)

**Decision:** the lockout key is the attempted `username`.

**Why not IP / both:**

- CP-01 indexed `(username, created_at)` — counting by username is a direct
  index range scan. Counting by IP would need a new index (extra migration,
  extra write cost) for a weaker control.
- The threat driver (Calca) is protecting _accounts_ at a sede. A sede is
  typically behind one NAT/public IP, so IP-locking would lock out the entire
  sede the moment one attacker hits it — a self-inflicted DoS on legitimate
  cashiers sharing that IP.
- IP is trivially rotated by an attacker; username is the stable thing being
  attacked. Username-locking is precise and index-aligned.

Consequence: an attacker spraying _many distinct usernames_ from one IP is not
throttled by this control — that is a distributed-credential-stuffing shape
better handled by an edge rate-limiter (out of scope; noted as a residual risk).

## D2 — Sliding-window count, no counter column, no reset logic

**Decision:** `LockoutService.isLocked(username)` runs a single
`COUNT(*)` over `login_audit WHERE username = :u AND outcome = 'failure'
AND created_at >= now() - :windowMinutes` and compares to the threshold.

- No new column, no mutable state → nothing to reset, nothing to drift.
- A successful login writes a `success` row (not counted) and simply stops
  producing `failure` rows; old failures roll off the window → the account
  self-unlocks. This satisfies the "success resets the count" requirement
  implicitly and correctly.
- Query uses the existing composite index; `outcome` is filtered in the WHERE
  but the index range on `(username, created_at)` already narrows to a tiny row
  set, so scanning `outcome` on those rows is cheap. **No new index needed.**
- Implemented via `repo.count({ where: { username, outcome:'failure',
createdAt: MoreThanOrEqual(threshold) } })` (TypeORM, typed — no raw SQL,
  lint-clean).

## D3 — Threshold selection incl. `sistema`

**Decision:** `thresholdFor(username)` returns the system threshold when
`username === 'sistema'`, else the normal threshold.

- `LOGIN_LOCKOUT_MAX_FAILURES` (default 5), `LOGIN_LOCKOUT_WINDOW_MINUTES`
  (default 15), `LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES` (default 20).
- Parsed once via a small typed `readIntEnv(name, def)` helper that falls back
  to the default on `NaN`/missing/<=0 — no `parseInt` scattered, lint-clean.
- `sistema` gets a higher threshold (still throttled) but, because the window
  is sliding, it can never be permanently bricked → satisfies the break-glass
  requirement without any admin-unlock dependency. We key on the literal
  `'sistema'` username rather than loading the user (the lockout gate runs
  before we've committed to a user lookup path, and it must work even for the
  unknown-user branch; the sentinel username is stable and seed-defined).

## D4 — Gate placement in `AuthService.login`

**Decision:** insert the lockout gate as the FIRST step of `login`, before
`users.findByUsername` is even needed for the decision (we only need the
attempted username). Concretely, right at the top:

```
const locked = await this.lockout.isLocked(input.username);
if (locked.isLocked) {
  await this.emitAlertBestEffort({ username, sede, ip, failureCount });
  throw new TooManyAttemptsException();  // 429
}
```

Then the existing CP-01 flow (findByUsername → unknown/inactive/bad_password/
success) runs unchanged. `bcrypt.compare` is only reached when not locked →
saves the hash cost under attack and prevents password probing of a locked id.

**Exception type:** a new `TooManyAttemptsException extends HttpException` with
status `429`, message `"Too many login attempts. Try again later."` — distinct
from the generic `"Invalid credentials"`. Enumeration analysis: reaching this
state means the caller already hammered _that_ username; it reveals nothing a
brute-forcer doesn't already know. The generic message is preserved for the
single-wrong-password and unknown-user branches, so a one-off probe never leaks
existence. (Justified in proposal Decisions.)

## D5 — Fail-OPEN on count error

**Decision:** `LockoutService.isLocked` wraps the count in try/catch; on error
it logs and returns `{ isLocked:false, failureCount:0 }`.

**Why fail-open, not fail-closed:**

- Fail-closed under a DB hiccup would lock out _every_ user including the legit
  admin trying to fix the very outage — turns a transient DB blip into a total
  auth outage. That is operationally worse than the narrow risk of fail-open.
- Fail-open does NOT open the door: normal password auth still runs. The only
  thing lost during the (rare, transient) count failure is the _throttle_, for
  the duration of the DB problem — attempts still need correct credentials.
- Mirrors CP-01's best-effort philosophy (audit availability < auth
  availability). Documented in README + design.

## D6 — `LoginLockoutAlert` entity + migration

**Entity** `apps/api/src/auth/entities/login-lockout-alert.entity.ts`
(glob-registered like CP-01, no array edit). `@Entity('login_lockout_alert')`:

- `id` uuid PK
- `username` varchar(255) NOT NULL
- `sede` varchar(50) nullable (from `process.env.STORE_ID`, same source as audit)
- `ipAddress` varchar(45) nullable
- `failureCount` int NOT NULL (the count that tripped the threshold)
- `channel` varchar(30) NOT NULL (which AlertChannel handled delivery, e.g. `log`)
- `createdAt` @CreateDateColumn timestamptz (the event _time_ — the Calca driver)
- No UpdateDateColumn — append-only evidence, like `login_audit`.

**Migration** `<ts>-CreateLoginLockoutAlert.ts`, timestamp AFTER
`1782959652527` (CP-01). Raw `CREATE TABLE IF NOT EXISTS` + index on
`created_at DESC` (for future admin listing / recency). `down()` drops index
then table. Same raw-SQL style as CP-01.

## D7 — Alert emission + pluggable `AlertChannel`

**Interface** `apps/api/src/auth/alerts/alert-channel.ts`:

```
export interface LockoutAlertPayload {
  username: string; sede: string | null; ipAddress: string | null;
  failureCount: number; occurredAt: Date;
}
export interface AlertChannel {
  readonly name: string;
  send(payload: LockoutAlertPayload): Promise<void>;
}
```

No `Function` type — a named interface method (lint-clean).

**Default impl** `LogAlertChannel implements AlertChannel` (`name = 'log'`):
`send()` writes a structured `logger.warn` with sede + time + username +
failureCount and resolves. No infra. This is the bound default.

**Selection** `LOCKOUT_ALERT_CHANNEL` (default `log`). A tiny factory/provider
resolves the channel by name; unknown/unset → `LogAlertChannel`. Only `log`
ships now; the map is the extension point for future email/webhook/hub impls
(each of which would bring its own documented env — flagged, not wired).

**`AlertService.emit(payload)`** (best-effort, CP-01 pattern):

1. `channel.send(payload)` inside try/catch (never rethrows)
2. persist a `login_lockout_alert` row (`channel = channel.name`) inside its own
   try/catch (never rethrows)
3. always logs a structured line as the durable floor.
   Called from `AuthService` via a private `emitAlertBestEffort()` `.catch()`
   wrapper so a rejected promise can never surface — identical belt-and-suspenders
   to CP-01's `recordAudit`.

## D8 — Module wiring

`AuthModule` adds:

- `TypeOrmModule.forFeature([LoginAudit, LoginLockoutAlert])` (append the new entity)
- providers: `LockoutService`, `AlertService`, and the channel provider
  (`{ provide: 'ALERT_CHANNEL', useFactory: () => resolveChannel(...) }` or a
  class provider for `LogAlertChannel` — chosen to stay DI-testable).
  No new module; mirrors CP-01 keeping everything under `AuthModule`.

---

## Alternatives rejected

- **Mutable `failed_attempts`/`locked_until` columns on `users`** — needs a
  users migration, reset logic on success, and drifts if writes race; the audit
  log already holds the truth. Rejected.
- **IP-based / edge rate-limiter** — wrong granularity for shared-NAT sedes;
  needs infra not present. Noted as residual (distributed stuffing) risk.
- **Fail-closed** — turns DB blips into full auth outages incl. the admin
  needed to fix them. Rejected (D5).
- **Loading the User to decide the sistema policy** — the gate must run for the
  unknown-user path too and before committing to the lookup path; sentinel
  username `'sistema'` is stable and seed-defined. Rejected in favor of the
  literal check.
- **Hard-wiring email now** — needs SMTP infra/creds not present; violates
  "don't hard-depend on infra". Deferred behind the `AlertChannel` seam.

## New env vars (README, same PR)

| Var                                 | Default | Meaning                                                               |
| ----------------------------------- | ------- | --------------------------------------------------------------------- |
| `LOGIN_LOCKOUT_MAX_FAILURES`        | `5`     | Failed attempts within the window before an identity is locked        |
| `LOGIN_LOCKOUT_WINDOW_MINUTES`      | `15`    | Sliding window (also the effective cooldown)                          |
| `LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES` | `20`    | Higher threshold for the `sistema` break-glass user (never permanent) |
| `LOCKOUT_ALERT_CHANNEL`             | `log`   | Alert delivery channel; only `log` (no-op/persist) ships now          |

Future/flagged (NOT wired this PR, documented as deferred): `SMTP_*` /
`LOCKOUT_ALERT_WEBHOOK_URL` — required only if/when a real channel is added.

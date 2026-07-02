# Design: CP-01 Login traceability

Constraints: `synchronize:false` (migration required), strict TDD, diff <400 lines,
must not break existing auth/login or CarboPuntos. Reuse existing patterns.

## Decisions

### D1 — Entity `LoginAudit`, append-only, glob-registered

New file `apps/api/src/auth/entities/login-audit.entity.ts`. Entities are
glob-registered (`entities: [__dirname + '/../**/*.entity{.ts,.js}']`) so NO manual
array edit is needed. Follow the `CarbopuntosPendingMovement` precedent: `timestamptz`
timestamps, explicit `name` snake_case columns.

```
@Entity('login_audit')
class LoginAudit {
  @PrimaryGeneratedColumn('uuid') id: string;               // uuid PK (precedent)
  @Column varchar(255)            username: string;          // attempted, even if unknown
  @Column varchar(20)             outcome: 'success'|'failure';
  @Column varchar(30) nullable    reason: 'bad_password'|'unknown_user'|'inactive'|null;
  @Column int nullable            userId: number | null;     // null on unknown_user
  @Column varchar(45) nullable    ipAddress: string | null;  // 45 = IPv6 max
  @Column text nullable           userAgent: string | null;
  @Column varchar(50) nullable    sede: string | null;       // STORE_ID
  @CreateDateColumn timestamptz   createdAt: Date;
}
```

No `@UpdateDateColumn`, no FK to `users` (attempts reference usernames that may not
exist; a hard FK would reject the very spray rows we want to keep). `userId` is a
plain nullable int, not a relation.

### D2 — Migration `CreateLoginAudit`

Raw SQL `CREATE TABLE` mirroring the entity, following the existing migration style
(`AddIsSystemToUsers`, `CreateRewardTable`). Timestamp-prefixed filename AFTER the
latest (`1782959652526`). `down()` drops the table. Index on `(created_at)` for the
DESC list query and a composite `(username, created_at)` to make CP-02's future
per-user failure count cheap — added now because it is free and forward-compatible.

### D3 — Request context capture in the controller

`AuthService` has no request object, so the controller captures context and passes it
down. Extend the login signature:

```
// controller
@Post('login')
async login(@Body(...) input, @Req() req: Request, @Res(...) res) {
  const ctx = { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
  const { user, token } = await this.auth.login(input, ctx);
  ...
}
```

`trust proxy` is already set in `main.ts`, so `req.ip` is the real client IP behind
Traefik. `sede` is read inside `LoginAuditService` from `process.env.STORE_ID` (one
API instance per sede — there is no per-request sede in this POS).

### D4 — `LoginAuditService.record(...)` swallows its own errors (best-effort)

New `apps/api/src/auth/login-audit.service.ts` injecting
`Repository<LoginAudit>`:

```
async record(row: NewLoginAudit): Promise<void> {
  try { await this.repo.insert({ ...row, sede: process.env.STORE_ID ?? null }); }
  catch (e) { this.logger.error('login audit write failed', e); } // never rethrow
}
```

This is the **best-effort failure policy**: authentication availability outranks
audit completeness. A DB hiccup on `login_audit` can never turn a valid login into a
500 nor mask a real auth error. `record` is `void` and awaited (so tests are
deterministic) but internally cannot throw.

### D5 — Emit rows inside `AuthService.login` (single source of the three branches)

The service owns the unknown-user / inactive / bad-password branches, so it is the
only correct emission point. Rewrite so each branch records then re-throws:

```
async login(input, ctx): Promise<AuthResult> {
  const user = await this.users.findByUsername(input.username);
  if (!user?.passwordHash) {
    await this.audit.record({ ...ctx, username: input.username, outcome:'failure',
      reason:'unknown_user', userId: user?.id ?? null });
    throw new UnauthorizedException('Invalid credentials');
  }
  if (!user.isActive) {
    await this.audit.record({ ...ctx, username: input.username, outcome:'failure',
      reason:'inactive', userId: user.id });
    throw new UnauthorizedException('Account is deactivated');
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    await this.audit.record({ ...ctx, username: input.username, outcome:'failure',
      reason:'bad_password', userId: user.id });
    throw new UnauthorizedException('Invalid credentials');
  }
  await this.audit.record({ ...ctx, username: input.username, outcome:'success',
    reason:null, userId: user.id });
  return { user, token: this.sign(user) };
}
```

`ctx` defaults to `{ ip:null, userAgent:null }` so existing test callers that call
`login(input)` without context still compile (backward-compatible optional param).

### D6 — Read endpoint on the auth controller

`GET /api/auth/login-audit` on the existing `AuthController`, guarded per the
`UsersController` precedent:

```
@Get('login-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
list(@Query() q) { return this.audit.list(page, limit); }
```

`LoginAuditService.list` uses `findAndCount` ordered by `createdAt DESC`, returning
`{ data, page, limit, total }` (mirrors the sales pagination shape). Query params
validated/clamped (limit default 20, max 100) via a small Zod schema like the login
schema.

### D7 — Module wiring

`AuthModule` adds `TypeOrmModule.forFeature([LoginAudit])` and provides
`LoginAuditService`. No new module needed — audit is an auth concern.

## Alternatives considered

- **NestJS interceptor for context** — rejected; the three failure branches live in
  the service, and an interceptor cannot see which branch fired or the resolved user.
- **FK from `login_audit.user_id` to `users.id`** — rejected; would reject
  unknown-user rows, which are the highest-signal spray evidence.
- **`await`-less fire-and-forget record** — rejected; awaiting a self-catching
  method keeps tests deterministic without risking the login path.

## Test surface (strict TDD — each task names its test)

Unit specs on `AuthService` (4 outcome branches + best-effort swallow), a
`LoginAuditService` spec (record + list), and a controller/guard spec for the admin
endpoint. No CI e2e with real Postgres (repo convention keeps hub e2e local).

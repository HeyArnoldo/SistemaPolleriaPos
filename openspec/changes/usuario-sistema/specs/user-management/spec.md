# user-management (delta) — Immovable "sistema" user

## MODIFIED Requirements

### Requirement: System user marker

The `users` table SHALL carry a boolean `is_system` column (entity `isSystem`)
that defaults to `false`. This column marks accounts that are immovable via the
application. It is the sole predicate used by mutation guards.

#### Scenario: Existing users are not system users

- **WHEN** the `is_system` column is added by migration
- **THEN** every pre-existing user row has `is_system = false`
- **AND** the column default for new rows is `false`

#### Scenario: Entity default is false

- **WHEN** a new `User` entity is instantiated without setting `isSystem`
- **THEN** `isSystem` is `false`

### Requirement: Seed provisions the sistema user

The database seed SHALL provision a user named `sistema` with the admin role and
`isSystem = true`, using the password from env `SYSTEM_USER_PASSWORD`. The seed
MUST NOT contain a hardcoded password.

#### Scenario: Seed creates the sistema user when env is set

- **WHEN** the seed runs with `SYSTEM_USER_PASSWORD` set and no `sistema` user exists
- **THEN** a `sistema` user is created with role `admin`, `isSystem = true`, `isActive = true`
- **AND** the password is stored as a single bcrypt hash (no double hashing)

#### Scenario: Seed skips loudly when env is absent

- **WHEN** the seed runs and `SYSTEM_USER_PASSWORD` is not set
- **THEN** the seed logs a clear skip message and does NOT create a `sistema` user
- **AND** the seed does NOT throw and does NOT invent a default password

#### Scenario: Seed is idempotent

- **WHEN** the seed runs a second time with the `sistema` user already present
- **THEN** no duplicate `sistema` user is created and the seed does not error

### Requirement: The sistema user is immovable via the app

The user update path SHALL reject any mutation targeting a user with
`isSystem = true` that would deactivate it, change its role, rename it, or change
its password. No DELETE endpoint exists and none is added.

#### Scenario: Cannot deactivate the sistema user

- **WHEN** an admin PATCHes the sistema user with `isActive = false`
- **THEN** the request is rejected with a forbidden error
- **AND** the sistema user remains active

#### Scenario: Cannot change the sistema user's role

- **WHEN** an admin PATCHes the sistema user with a different `role`
- **THEN** the request is rejected with a forbidden error
- **AND** the sistema user keeps the admin role

#### Scenario: Cannot rename the sistema user

- **WHEN** an admin PATCHes the sistema user with a different `username`
- **THEN** the request is rejected with a forbidden error

#### Scenario: Cannot change the sistema user's password

- **WHEN** an admin PATCHes the sistema user with a new `password`
- **THEN** the request is rejected with a forbidden error

#### Scenario: Non-system users remain fully editable

- **WHEN** an admin PATCHes a user with `isSystem = false`
- **THEN** the update proceeds normally (deactivate, role, rename, password all allowed)

# Spec: carbopuntos-reversal

Capability: full **net reversal** of a sale's point movements when a sale is cancelled,
covering both accrued and redeemed points, idempotent and auditable in the hub ledger.

## ADDED Requirements

### Requirement: Net reversal of all sale movements

The hub `POST /points/reverse` SHALL reverse the **net** point effect of ALL non-voided
movements (`accrual`, `redeem`, and mixed-operation movements) that carry the given
`saleRef` for the customer, not only the accrual.

The reversal SHALL be persisted as a single `reversal` movement whose `points` equal
`-(sum of points of the matched non-voided movements)`, so the customer's balance returns to
its pre-sale value (redeemed points given back, accrued points removed).

#### Scenario: Cancel a mixed sale (accrue + redeem)

- **Given** a customer with balance 0 and a sale that accrued 10 and redeemed 10 (balance still 0)
- **When** the hub receives a reverse for that `saleRef`
- **Then** a single `reversal` movement of `points = 0` is written and the balance stays 0
- **And** the customer is not left short any redeemed points

#### Scenario: Cancel a redeem-only sale (no accrual)

- **Given** a customer with balance 50 and a redeem-only sale that spent 20 (balance 30)
- **When** the hub receives a reverse for that `saleRef`
- **Then** a `reversal` movement of `points = +20` is written and the balance returns to 50
- **And** the previous C15 no-op / manual-review case no longer applies

#### Scenario: Cancel an accrual-only sale (regression)

- **Given** a customer with balance 40 and an accrual-only sale that added 15 (balance 55)
- **When** the hub receives a reverse for that `saleRef`
- **Then** a `reversal` movement of `points = -15` is written and the balance returns to 40

### Requirement: Idempotent reversal

Reversing the same sale twice SHALL NOT double-refund.

The hub SHALL treat a reverse as a replay when a movement with the same `idempotencyKey`
already exists, returning it unchanged; additionally, if a non-voided `reversal` movement
already exists for the `saleRef`, the hub SHALL NOT apply a second balance change.

#### Scenario: Double cancel

- **Given** a sale already reversed for its `saleRef`
- **When** a second reverse with the same `idempotencyKey` (or a different key, same `saleRef`) arrives
- **Then** no additional balance change occurs and a movement is returned per the single-movement contract

### Requirement: Balance floor on reversal

A reversal that would drive the balance below zero SHALL be capped so the balance floors at 0
(D6). The applied vs requested delta SHALL be recorded in the reversal movement `detail` for audit.

#### Scenario: Reversal would overdraw

- **Given** a customer whose current balance is lower than the accrued points being removed
- **When** the reverse is applied
- **Then** the balance floors at 0 and the movement `detail` states the partial reversal

### Requirement: No-op when nothing to reverse

When no non-voided movements exist for the `saleRef` (e.g., a sale cancelled before any
accrual reached the hub — C15), the hub SHALL write a 0-point `reversal` movement (balance
intact) so the single-movement contract always holds.

#### Scenario: Reverse a sale the hub never accrued

- **Given** no movements exist for the `saleRef`
- **When** the reverse arrives
- **Then** a `reversal` movement of `points = 0` is written and the balance is unchanged

### Requirement: Single-movement contract preserved

The reverse endpoint SHALL keep returning a single `PointsMovement`. The `reverseSchema`
contract, `@app/carbopuntos-client.reverse`, the API caller, and the pending-queue retry
SHALL remain source-compatible (no breaking contract change).

## MODIFIED Requirements

### Requirement: API sale-void reversal is resilient and complete

When a sale is cancelled, the API SHALL issue a best-effort hub reverse using the stable
`${STORE_ID}:${saleNumber}:reversal` idempotency key, enqueue on transient failure, and
NEVER block the cancellation on hub availability. The obsolete redeem-only "manual review"
compensation branch SHALL be removed because the hub now reverses redemptions.

#### Scenario: Hub down during cancel

- **Given** the hub is unavailable when a canje sale is cancelled
- **When** the cashier cancels the sale
- **Then** the cancellation succeeds locally and the reverse is enqueued for retry with the same key

#### Scenario: Retry reverses redeemed points

- **When** the pending reverse is retried after the hub recovers
- **Then** both accrued and redeemed points are reconciled via the single net reversal

### Requirement: Caja report excludes cancelled and canje-only distortions

The caja close/report SHALL continue to exclude cancelled sales from totals and SHALL NOT
let canje-only sales (monetary total 0) distort caja figures, since a canje is a courtesy and
does not touch soles (D4). This shares the `cancelSale` code path with CP-05.

#### Scenario: Cancelled canje sale absent from caja

- **Given** a canje sale that was cancelled (and its points reversed)
- **When** the caja report is generated for that day
- **Then** the sale contributes nothing to caja totals

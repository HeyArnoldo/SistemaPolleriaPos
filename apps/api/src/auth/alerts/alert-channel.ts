/**
 * AlertChannel — pluggable interface for lockout alert delivery.
 * The default implementation is LogAlertChannel (name='log').
 * Future implementations (email, webhook, hub) each bring their own env config.
 */

export interface LockoutAlertPayload {
  username: string;
  sede: string | null;
  ipAddress: string | null;
  failureCount: number;
  occurredAt: Date;
}

export interface AlertChannel {
  /** Unique name identifying this channel (e.g. 'log', 'email'). */
  readonly name: string;
  /** Deliver the alert payload. Should not rethrow — caller wraps in try/catch. */
  send(payload: LockoutAlertPayload): Promise<void>;
}

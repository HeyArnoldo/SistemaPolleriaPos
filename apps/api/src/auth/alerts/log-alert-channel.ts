import { Injectable, Logger } from '@nestjs/common';
import { AlertChannel, LockoutAlertPayload } from './alert-channel';

/**
 * LogAlertChannel — default alert delivery implementation.
 * Writes a structured warn log line; requires no external infrastructure.
 * name='log' (matches LOCKOUT_ALERT_CHANNEL default).
 */
@Injectable()
export class LogAlertChannel implements AlertChannel {
  private readonly logger = new Logger(LogAlertChannel.name);

  readonly name = 'log';

  async send(payload: LockoutAlertPayload): Promise<void> {
    this.logger.warn(
      `[LOCKOUT ALERT] username=${payload.username} sede=${payload.sede ?? 'unknown'} ` +
        `failureCount=${payload.failureCount} occurredAt=${payload.occurredAt.toISOString()}`,
    );
  }
}

/**
 * Resolve the alert channel implementation by name.
 * Unknown or unset values default to LogAlertChannel.
 */
export function resolveAlertChannel(): AlertChannel {
  const channelName = process.env.LOCKOUT_ALERT_CHANNEL ?? 'log';
  // Only 'log' ships now. Add future channels here (email, webhook, etc.).
  if (channelName === 'log') {
    return new LogAlertChannel();
  }
  // Unknown channel → fall back to log (never hard-fail on unrecognized config)
  return new LogAlertChannel();
}

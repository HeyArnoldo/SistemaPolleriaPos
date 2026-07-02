import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertChannel, LockoutAlertPayload } from './alerts/alert-channel';
import { LoginLockoutAlert } from './entities/login-lockout-alert.entity';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @Inject('ALERT_CHANNEL') private readonly channel: AlertChannel,
    @InjectRepository(LoginLockoutAlert)
    private readonly repo: Repository<LoginLockoutAlert>,
  ) {}

  /**
   * Emit a lockout alert: deliver via the configured channel AND persist a
   * login_lockout_alert row. Both operations are best-effort (independent
   * try/catch blocks that never rethrow). Always logs a structured line as
   * the durable floor.
   */
  async emit(payload: LockoutAlertPayload): Promise<void> {
    // 1. Channel delivery — best-effort
    try {
      await this.channel.send(payload);
    } catch (e) {
      this.logger.error(
        `AlertService: channel '${this.channel.name}' send failed (best-effort, continuing)`,
        e,
      );
    }

    // 2. Persist alert row — best-effort
    try {
      await this.repo.insert({
        username: payload.username,
        sede: payload.sede,
        ipAddress: payload.ipAddress,
        failureCount: payload.failureCount,
        channel: this.channel.name,
      });
    } catch (e) {
      this.logger.error('AlertService: alert persist failed (best-effort)', e);
    }

    // 3. Durable structured log (always runs)
    this.logger.warn(
      `[LOCKOUT] username=${payload.username} sede=${payload.sede ?? 'unknown'} ` +
        `ip=${payload.ipAddress ?? 'unknown'} failures=${payload.failureCount} ` +
        `channel=${this.channel.name}`,
    );
  }
}

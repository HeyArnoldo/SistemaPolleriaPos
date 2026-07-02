import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AlertChannel, LockoutAlertPayload } from './alerts/alert-channel';
import { LoginLockoutAlert } from './entities/login-lockout-alert.entity';
import { DEFAULT_WINDOW_MINUTES, readIntEnv } from './lockout.service';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  /**
   * Sliding-window length in minutes. Reads the SAME env var and default as
   * LockoutService so alert de-dup and lockout enforcement share one window.
   */
  private readonly windowMinutes: number;

  constructor(
    @Inject('ALERT_CHANNEL') private readonly channel: AlertChannel,
    @InjectRepository(LoginLockoutAlert)
    private readonly repo: Repository<LoginLockoutAlert>,
  ) {
    this.windowMinutes = readIntEnv('LOGIN_LOCKOUT_WINDOW_MINUTES', DEFAULT_WINDOW_MINUTES);
  }

  /**
   * Best-effort de-dup: returns true if an alert for this username already
   * exists within the current lockout window. Fails OPEN (returns false) if the
   * query throws, so a transient DB error never suppresses a real alert.
   */
  private async alreadyAlertedInWindow(username: string): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000);
      const existing = await this.repo.count({
        where: { username, createdAt: MoreThanOrEqual(windowStart) },
      });
      return existing > 0;
    } catch (e) {
      this.logger.error('AlertService: dedupe check failed (best-effort, emitting anyway)', e);
      return false;
    }
  }

  /**
   * Emit a lockout alert: deliver via the configured channel AND persist a
   * login_lockout_alert row. Both operations are best-effort (independent
   * try/catch blocks that never rethrow). Always logs a structured line as
   * the durable floor.
   *
   * De-duplicated per lockout episode: if an alert for this username already
   * exists within the current window, this call is a no-op (no channel send,
   * no persisted row, no warn log) to avoid attacker-controlled write/log
   * amplification under sustained brute-force. Lockout ENFORCEMENT (429) is
   * unaffected — it fires on every attempt in AuthService.
   */
  async emit(payload: LockoutAlertPayload): Promise<void> {
    // 0. De-dup — at most one alert per lockout episode per window
    if (await this.alreadyAlertedInWindow(payload.username)) {
      this.logger.debug(
        `AlertService: alert for '${payload.username}' already exists in window — skipping (deduped)`,
      );
      return;
    }

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

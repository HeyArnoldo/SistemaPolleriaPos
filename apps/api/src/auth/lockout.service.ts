import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { LoginAudit } from './entities/login-audit.entity';

export interface LockoutResult {
  isLocked: boolean;
  failureCount: number;
}

/** Sentinel username for the break-glass system support user. */
const SISTEMA_USERNAME = 'sistema';

/** Default policy values (overridable via env). */
const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MINUTES = 15;
const DEFAULT_SYSTEM_MAX_FAILURES = 20;

/**
 * Read an integer from an environment variable, falling back to the supplied
 * default when the variable is absent, empty, NaN, or <= 0.
 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);

  /** Normal failure threshold (attempts before lockout). */
  private readonly maxFailures: number;
  /** Sliding window length in minutes. */
  private readonly windowMinutes: number;
  /** Higher threshold for the break-glass 'sistema' user. */
  private readonly systemMaxFailures: number;

  constructor(
    @InjectRepository(LoginAudit)
    private readonly repo: Repository<LoginAudit>,
  ) {
    this.maxFailures = readIntEnv('LOGIN_LOCKOUT_MAX_FAILURES', DEFAULT_MAX_FAILURES);
    this.windowMinutes = readIntEnv('LOGIN_LOCKOUT_WINDOW_MINUTES', DEFAULT_WINDOW_MINUTES);
    this.systemMaxFailures = readIntEnv(
      'LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES',
      DEFAULT_SYSTEM_MAX_FAILURES,
    );
  }

  /**
   * Returns the applicable failure threshold for the given username.
   * 'sistema' gets a higher threshold (throttled but never permanently locked).
   */
  private thresholdFor(username: string): number {
    return username === SISTEMA_USERNAME ? this.systemMaxFailures : this.maxFailures;
  }

  /**
   * Determine whether the identity is currently locked.
   * Uses a sliding-window COUNT over login_audit failure rows.
   *
   * FAIL-OPEN: if the count query throws, logs the error and returns
   * { isLocked: false, failureCount: 0 } — a transient DB error must never
   * lock out every user.
   */
  async isLocked(username: string): Promise<LockoutResult> {
    try {
      const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000);

      const failureCount = await this.repo.count({
        where: {
          username,
          outcome: 'failure',
          createdAt: MoreThanOrEqual(windowStart),
        },
      });

      const threshold = this.thresholdFor(username);
      return { isLocked: failureCount >= threshold, failureCount };
    } catch (e) {
      this.logger.error(
        'LockoutService.isLocked count query failed — failing open (auth will proceed)',
        e,
      );
      return { isLocked: false, failureCount: 0 };
    }
  }
}

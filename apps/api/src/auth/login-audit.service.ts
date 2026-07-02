import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAudit, LoginFailureReason, LoginOutcome } from './entities/login-audit.entity';

export interface NewLoginAuditRow {
  username: string;
  outcome: LoginOutcome;
  reason: LoginFailureReason | null;
  userId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginAuditPage {
  data: LoginAudit[];
  page: number;
  limit: number;
  total: number;
}

const MAX_LIST_LIMIT = 100;

@Injectable()
export class LoginAuditService {
  private readonly logger = new Logger(LoginAuditService.name);

  constructor(
    @InjectRepository(LoginAudit)
    private readonly repo: Repository<LoginAudit>,
  ) {}

  /**
   * Record a login attempt. BEST-EFFORT: swallows all errors so that an audit
   * write failure never breaks the authentication flow.
   */
  async record(row: NewLoginAuditRow): Promise<void> {
    try {
      await this.repo.insert({
        ...row,
        sede: process.env.STORE_ID ?? null,
      });
    } catch (e) {
      this.logger.error('login audit write failed', e);
      // never rethrow — audit failures must not surface to callers
    }
  }

  /** List recent audit rows, most-recent-first, with pagination. */
  async list(page: number, limit: number): Promise<LoginAuditPage> {
    const clampedLimit = Math.min(limit, MAX_LIST_LIMIT);
    const skip = (page - 1) * clampedLimit;

    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: clampedLimit,
    });

    return { data, page, limit: clampedLimit, total };
  }
}

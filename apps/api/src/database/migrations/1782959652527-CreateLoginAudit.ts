import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoginAudit1782959652527 implements MigrationInterface {
  name = 'CreateLoginAudit1782959652527';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Append-only audit log for every login attempt (CP-01).
    // No FK to users: unknown-user attempts must also be recorded.
    // outcome: 'success' | 'failure'
    // reason:  'bad_password' | 'unknown_user' | 'inactive' | null (on success)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_audit" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "username"     varchar(255) NOT NULL,
        "outcome"      varchar(20)  NOT NULL,
        "reason"       varchar(30)  DEFAULT NULL,
        "user_id"      integer      DEFAULT NULL,
        "ip_address"   varchar(45)  DEFAULT NULL,
        "user_agent"   text         DEFAULT NULL,
        "sede"         varchar(50)  DEFAULT NULL,
        "created_at"   timestamptz  NOT NULL DEFAULT now()
      )
    `);

    // Index for DESC pagination (admin read endpoint orders by created_at DESC).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_login_audit_created_at"
      ON "login_audit" ("created_at" DESC)
    `);

    // Composite index for CP-02: per-user/per-IP failure counting over a time window.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_login_audit_username_created_at"
      ON "login_audit" ("username", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_audit_username_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_audit_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_audit"`);
  }
}

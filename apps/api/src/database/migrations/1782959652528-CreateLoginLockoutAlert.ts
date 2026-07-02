import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoginLockoutAlert1782959652528 implements MigrationInterface {
  name = 'CreateLoginLockoutAlert1782959652528';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Append-only alert log for every lockout trigger (CP-02).
    // Records which channel handled delivery so alert history is auditable.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_lockout_alert" (
        "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "username"      varchar(255) NOT NULL,
        "sede"          varchar(50)  DEFAULT NULL,
        "ip_address"    varchar(45)  DEFAULT NULL,
        "failure_count" integer      NOT NULL,
        "channel"       varchar(30)  NOT NULL,
        "created_at"    timestamptz  NOT NULL DEFAULT now()
      )
    `);

    // Index for recency-based admin listing (most-recent-first).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_login_lockout_alert_created_at"
      ON "login_lockout_alert" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_lockout_alert_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_lockout_alert"`);
  }
}

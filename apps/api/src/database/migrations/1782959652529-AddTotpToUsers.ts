import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotpToUsers1782959652529 implements MigrationInterface {
  name = 'AddTotpToUsers1782959652529';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additive migration — no existing rows are invalidated.
    // totpSecret: encrypted AES-256-GCM envelope; null until enrollment.
    // Stored as text: envelopes are small but operator-supplied secrets are
    // unbounded, so a fixed varchar could overflow and crash the seed.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "totp_secret" text DEFAULT NULL
    `);

    // totpEnabled: disabled by default; activated only after confirm step.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "totp_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_secret"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNextRetryAtToPendingMovement1781300004000 implements MigrationInterface {
  name = 'AddNextRetryAtToPendingMovement1781300004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Per-attempt backoff: retryPending only picks up movements whose
    // next_retry_at has elapsed (or is null). Null means "retry ASAP".
    await queryRunner.query(`
      ALTER TABLE "carbopuntos_pending_movement"
      ADD COLUMN IF NOT EXISTS "next_retry_at" timestamptz DEFAULT NULL
    `);

    // Helps the scheduler query that filters by status + due time.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_carbopuntos_pending_next_retry_at"
      ON "carbopuntos_pending_movement" ("next_retry_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_carbopuntos_pending_next_retry_at"`);
    await queryRunner.query(`
      ALTER TABLE "carbopuntos_pending_movement" DROP COLUMN IF EXISTS "next_retry_at"
    `);
  }
}

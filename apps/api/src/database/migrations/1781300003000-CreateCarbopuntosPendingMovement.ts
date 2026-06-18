import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCarbopuntosPendingMovement1781300003000 implements MigrationInterface {
  name = 'CreateCarbopuntosPendingMovement1781300003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Local queue for hub operations that failed due to unavailability (D16).
    // Status lifecycle: pending → retrying → done | failed.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carbopuntos_pending_movement" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "operation" varchar(20) NOT NULL,
        "customer_dni" varchar(8) NOT NULL,
        "sale_ref" varchar(50) DEFAULT NULL,
        "points" integer NOT NULL DEFAULT 0,
        "idempotency_key" varchar(255) DEFAULT NULL,
        "user_ref" varchar(255) DEFAULT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "last_error" text DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_carbopuntos_pending_status"
      ON "carbopuntos_pending_movement" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_carbopuntos_pending_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carbopuntos_pending_movement"`);
  }
}

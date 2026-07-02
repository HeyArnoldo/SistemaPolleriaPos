import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaleRedemption1783022102458 implements MigrationInterface {
  name = 'CreateSaleRedemption1783022102458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Stores each reward redeemed in a sale (1-N child of sales).
    // product_id is a weak nullable int ref — no FK (prizes are not bound to Product today).
    // ON DELETE CASCADE ensures rows are removed if the parent sale is hard-deleted.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_redemptions" (
        "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id"     integer     NOT NULL,
        "description" varchar(255) NOT NULL,
        "cost_points" integer     NOT NULL,
        "product_id"  integer     DEFAULT NULL,
        "quantity"    integer     NOT NULL DEFAULT 1,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_sale_redemptions_sale"
          FOREIGN KEY ("sale_id") REFERENCES "sales" ("id") ON DELETE CASCADE
      )
    `);

    // Index for the common query pattern: fetch redemptions by sale.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_redemptions_sale_id"
      ON "sale_redemptions" ("sale_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_redemptions_sale_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_redemptions"`);
  }
}

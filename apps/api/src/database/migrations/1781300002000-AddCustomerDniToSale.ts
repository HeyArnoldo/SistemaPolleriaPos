import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerDniToSale1781300002000 implements MigrationInterface {
  name = 'AddCustomerDniToSale1781300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Weak reference to hub customer — no FK (D20).
    // The customer lives in the hub DB; this is only a tracing reference.
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD COLUMN IF NOT EXISTS "customer_dni" varchar(8) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "customer_dni"`);
  }
}

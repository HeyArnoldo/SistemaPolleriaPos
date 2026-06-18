import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPuntajeToProduct1781300000000 implements MigrationInterface {
  name = 'AddPuntajeToProduct1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add puntaje column: points earned per unit sold with customer_dni (D3).
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "puntaje" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "puntaje"`);
  }
}

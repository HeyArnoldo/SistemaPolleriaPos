import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRewardTable1781300001000 implements MigrationInterface {
  name = 'CreateRewardTable1781300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Local reward catalog per sede (D2). No FK to hub — the hub is a separate DB.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rewards" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "cost_points" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rewards"`);
  }
}

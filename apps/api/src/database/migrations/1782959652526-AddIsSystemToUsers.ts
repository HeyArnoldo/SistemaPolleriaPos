import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSystemToUsers1782959652526 implements MigrationInterface {
  name = 'AddIsSystemToUsers1782959652526';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system"`);
  }
}
